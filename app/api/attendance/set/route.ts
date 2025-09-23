// app/api/attendance/set/route.ts
import { NextResponse } from "next/server";
// Ajusta esta ruta si tu admin client está en otro archivo:
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

/** Normaliza/corrige el status hacia los valores permitidos por tu BD (ES) */
function toDbStatus(input: string | undefined, fallback: "present" | "late" | "absent" | "justified"): "Presente" | "Tarde" | "Ausente" | "Justificado" {
  const key = (input ?? fallback).toString().trim().toLowerCase();

  // inglés
  if (key === "present" || key === "on_time") return "Presente";
  if (key === "late") return "Tarde";
  if (key === "absent") return "Ausente";
  if (key === "justified" || key === "justify") return "Justificado";

  // español (cualquier mayúsc/minúsc)
  if (key === "presente") return "Presente";
  if (key === "tarde") return "Tarde";
  if (key === "ausente") return "Ausente";
  if (key === "justificado") return "Justificado";

  // por defecto, asumimos presente
  return "Presente";
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    // Puede venir sessionId (numérico) o sessionCode (texto)
    const rawSessionId = body?.sessionId;
    const sessionCode = typeof body?.sessionCode === "string" ? body.sessionCode.trim() : "";

    // Detectar si sessionId es numérico (BIGINT en tu BD)
    let sessionIdNum: number | null = null;
    if (typeof rawSessionId === "number" && Number.isFinite(rawSessionId)) {
      sessionIdNum = rawSessionId;
    } else if (typeof rawSessionId === "string" && /^\d+$/.test(rawSessionId.trim())) {
      sessionIdNum = Number(rawSessionId.trim());
    }

    const explicitStatus = typeof body?.status === "string" ? body.status : undefined;
    const studentId = Number(body?.studentId);
    const studentName =
      typeof body?.studentName === "string" ? body.studentName.trim() : "";
    const finalStudentName = studentName && studentName.length > 0 ? studentName : `ID:${studentId}`;

    if (sessionIdNum === null && !sessionCode) {
      return NextResponse.json(
        { ok: false, error: "Falta sessionId (numérico) o sessionCode" },
        { status: 400 }
      );
    }
    if (!Number.isFinite(studentId) || studentId <= 0) {
      return NextResponse.json(
        { ok: false, error: "studentId inválido" },
        { status: 400 }
      );
    }

    /* 1) Resolver sesión */
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

    /* 2) Settings */
    const { data: gs, error: gsErr } = await supabaseAdmin
      .from("global_settings")
      .select("attendance_tolerance_min, late_threshold_min")
      .eq("id", 1)
      .maybeSingle();
    if (gsErr) return NextResponse.json({ ok: false, error: gsErr.message }, { status: 500 });

    const tol = Number(gs?.attendance_tolerance_min ?? 15);
    const lateTh = Number(gs?.late_threshold_min ?? 30);

    /* 3) Ventana y status */
    const baseStart = parseStartDate(ses);
    const windowFrom = new Date(baseStart.getTime() - tol * 60_000);
    const windowTo   = new Date(baseStart.getTime() + tol * 60_000);

    const now = new Date();
    const computed = now.getTime() - baseStart.getTime() >= lateTh * 60_000 ? "late" : "present";
    const dbStatus = toDbStatus(explicitStatus, computed); // 👈 siempre uno de: Presente/Tarde/Ausente/Justificado

    /* 4) Upsert manual (select -> update/insert) */
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
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 }
    );
  }
}
