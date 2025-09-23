// app/api/attendance/set/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/adminClient";

export const runtime = "nodejs";

/* Helpers */
function hhmmToTime(hhmm: string) {
  const m = hhmm.match(/^(\d{2})(\d{2})$/);
  if (!m) return hhmm;
  return `${m[1]}:${m[2]}`;
}
function parseStartDate(session: any): Date {
  const sd = session?.session_date;            // "YYYY-MM-DD"
  let sp = session?.start_planned as string | null; // "HH:MM" o "HHMM"
  const startedAt = session?.started_at;       // ISO
  if (sp && /^\d{4}$/.test(sp)) sp = hhmmToTime(sp);
  if (sd && sp) return new Date(`${sd}T${sp}:00`);
  if (startedAt) return new Date(startedAt);
  return new Date();
}
function toDbStatus(input: string | undefined, fallback: "present" | "late" | "absent" | "justified"): "Presente" | "Tarde" | "Ausente" | "Justificado" {
  const key = (input ?? fallback).toString().trim().toLowerCase();
  if (key === "present" || key === "on_time" || key === "presente") return "Presente";
  if (key === "late" || key === "tarde") return "Tarde";
  if (key === "absent" || key === "ausente") return "Ausente";
  if (key === "justified" || key === "justificado" || key === "justify") return "Justificado";
  return "Presente";
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    // sessionId (BIGINT) o sessionCode (texto)
    const rawSessionId = body?.sessionId;
    const sessionCode = typeof body?.sessionCode === "string" ? body.sessionCode.trim() : "";

    let sessionIdNum: number | null = null;
    if (typeof rawSessionId === "number" && Number.isFinite(rawSessionId)) sessionIdNum = rawSessionId;
    else if (typeof rawSessionId === "string" && /^\d+$/.test(rawSessionId.trim())) sessionIdNum = Number(rawSessionId.trim());

    const explicitStatus = typeof body?.status === "string" ? body.status : undefined;
    const studentId = Number(body?.studentId);
    const studentName = typeof body?.studentName === "string" ? body.studentName.trim() : "";
    const finalStudentName = studentName && studentName.length > 0 ? studentName : `ID:${studentId}`;

    if (sessionIdNum === null && !sessionCode) {
      return NextResponse.json({ ok: false, error: "Falta sessionId (numérico) o sessionCode" }, { status: 400 });
    }
    if (!Number.isFinite(studentId) || studentId <= 0) {
      return NextResponse.json({ ok: false, error: "studentId inválido" }, { status: 400 });
    }

    // 1) Sesión
    let ses: any = null;
    if (sessionIdNum !== null) {
      const { data, error } = await supabaseAdmin
        .from("sessions")
        .select("id, session_code, session_date, start_planned, started_at")
        .eq("id", sessionIdNum)
        .maybeSingle();
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      if (!data) return NextResponse.json({ ok: false, error: "session_not_found" }, { status: 404 });
      ses = data;
    } else {
      const { data, error } = await supabaseAdmin
        .from("sessions")
        .select("id, session_code, session_date, start_planned, started_at")
        .eq("session_code", sessionCode)
        .maybeSingle();
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      if (!data) return NextResponse.json({ ok: false, error: "session_not_found" }, { status: 404 });
      ses = data;
    }

    // 2) Settings (tolerancias + duración)
    const { data: gs, error: gsErr } = await supabaseAdmin
      .from("global_settings")
      .select("attendance_tolerance_min, late_threshold_min, class_duration_min")
      .eq("id", 1)
      .maybeSingle();
    if (gsErr) return NextResponse.json({ ok: false, error: gsErr.message }, { status: 500 });

    const tol = Number(gs?.attendance_tolerance_min ?? 15);
    const lateTh = Number(gs?.late_threshold_min ?? 30);
    const classDur = Number(gs?.class_duration_min ?? 60);

    // 3) Ventanas y bloqueo por fin de sesión
    const baseStart = parseStartDate(ses);
    const sessionEnd = new Date(baseStart.getTime() + classDur * 60_000);
    const windowFrom = new Date(baseStart.getTime() - tol * 60_000);
    const windowTo   = new Date(baseStart.getTime() + tol * 60_000);

    const now = new Date();
    const computed = now.getTime() - baseStart.getTime() >= lateTh * 60_000 ? "late" : "present";
    const dbStatus = toDbStatus(explicitStatus, computed);

    // 🔒 Regla: después de la sesión, solo Justificado se puede editar
    if (now > sessionEnd && dbStatus !== "Justificado") {
      return NextResponse.json({ ok: false, error: "locked_after_session" }, { status: 403 });
    }

    // 4) Upsert (select -> update/insert)
    const { data: existing, error: exErr } = await supabaseAdmin
      .from("attendance")
      .select("id")
      .eq("session_id", ses.id)
      .eq("student_id", studentId)
      .maybeSingle();
    if (exErr) return NextResponse.json({ ok: false, error: exErr.message }, { status: 500 });

    let result: any;
    if (existing?.id) {
      const { data, error } = await supabaseAdmin
        .from("attendance")
        .update({
          status: dbStatus,
          updated_at: new Date().toISOString(),
          updated_by: "system",
          student_name: finalStudentName,
        })
        .eq("id", existing.id)
        .select()
        .maybeSingle();
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      result = data;
    } else {
      const { data, error } = await supabaseAdmin
        .from("attendance")
        .insert({
          session_id: ses.id,
          student_id: studentId,
          student_name: finalStudentName,
          status: dbStatus,
          updated_at: new Date().toISOString(),
          updated_by: "system",
        })
        .select()
        .maybeSingle();
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      result = data;
    }

    return NextResponse.json({
      ok: true,
      record: result,
      window: { from: windowFrom.toISOString(), to: windowTo.toISOString() },
      sessionEnd: sessionEnd.toISOString(),
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
