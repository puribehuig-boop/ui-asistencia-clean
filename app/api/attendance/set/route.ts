// app/api/attendance/set/route.ts
import { NextResponse } from "next/server";

// ⬇️ Usa el mismo admin client que ya usas en tus endpoints de admin.
// Si tu archivo existe en "lib/supabaseAdmin.ts", deja la primera línea.
// Si lo tienes en "lib/supabase/supabaseAdmin.ts", usa la segunda y borra la primera.
// import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

// Utilidades pequeñas para parsear la hora planeada
function hhmmToTime(hhmm: string) {
  // "0800" -> "08:00"
  const m = hhmm.match(/^(\d{2})(\d{2})$/);
  if (!m) return hhmm;
  return `${m[1]}:${m[2]}`;
}
function parseStartDate(session: any): Date {
  // Preferimos combinar session_date + start_planned (si existen)
  const sd = session?.session_date;     // "YYYY-MM-DD"
  let sp = session?.start_planned;      // "HH:MM" o "HHMM"
  const startedAt = session?.started_at; // ISO
  if (typeof sp === "string" && /^\d{4}$/.test(sp)) sp = hhmmToTime(sp);
  if (sd && sp) return new Date(`${sd}T${sp}:00`);
  if (startedAt) return new Date(startedAt);
  return new Date(); // último recurso
}

/**
 * Request esperado (uno de los dos identificadores):
 * - { sessionId: "<uuid>", studentId: 1234, status?: "present"|"late"|"absent", studentName?: string }
 * - { sessionCode: "AULA-20250923-0800", studentId: 1234, ... }
 * 
 * Respuesta: { ok: true, record, window: { from, to } } | { ok: false, error }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const sessionId = (body?.sessionId ?? "").toString().trim();
    const sessionCode = (body?.sessionCode ?? "").toString().trim();
    const explicitStatus = body?.status as "present" | "late" | "absent" | undefined;

    // studentId suele ser número en tu tabla; envíalo como número si puedes
    const studentId = Number(body?.studentId);
    const studentName =
      typeof body?.studentName === "string" ? body.studentName.trim() : null;

    if (!sessionId && !sessionCode) {
      return NextResponse.json(
        { ok: false, error: "Falta sessionId o sessionCode" },
        { status: 400 }
      );
    }
    if (!Number.isFinite(studentId) || studentId <= 0) {
      return NextResponse.json(
        { ok: false, error: "studentId inválido" },
        { status: 400 }
      );
    }

    // 1) Resolver la sesión
    let ses: any = null;
    if (sessionId) {
      const { data, error } = await supabaseAdmin
        .from("sessions")
        .select("id, session_code, session_date, start_planned, started_at")
        .eq("id", sessionId)
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

    // 2) Leer settings
    const { data: gs, error: gsErr } = await supabaseAdmin
      .from("global_settings")
      .select("attendance_tolerance_min, late_threshold_min")
      .eq("id", 1)
      .maybeSingle();
    if (gsErr) return NextResponse.json({ ok: false, error: gsErr.message }, { status: 500 });

    const tol = Number(gs?.attendance_tolerance_min ?? 15); // minutos de ventana
    const lateTh = Number(gs?.late_threshold_m
