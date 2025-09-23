// app/api/teacher/sessions/[id]/export/route.ts
import { supabaseAdmin } from "@/lib/supabase/adminClient";

export const runtime = "nodejs";

function hhmmToTime(hhmm?: string | null) {
  if (!hhmm) return "";
  const m = (hhmm || "").match(/^(\d{2})(\d{2})$/);
  if (!m) return hhmm || "";
  return `${m[1]}:${m[2]}`;
}
function toHHMMSS(s?: string | null) {
  if (!s) return "";
  if (/^\d{2}:\d{2}:\d{2}$/.test(s)) return s!;
  if (/^\d{2}:\d{2}$/.test(s)) return `${s}:00`;
  if (/^\d{4}$/.test(s || "")) return `${s!.slice(0, 2)}:${s!.slice(2)}:00`;
  return s || "";
}
function roomFromSessionCode(code?: string | null): string | null {
  if (!code) return null;
  const toks = code.split("-");
  const iDate = toks.findIndex((t) => /^\d{8}$/.test(t));
  if (iDate > 0) return toks.slice(0, iDate).join("-");
  return toks[0] || null;
}
function csvEscape(v: any) {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function kvRows(obj: Record<string, any>): string[] {
  return Object.entries(obj).map(([k, v]) => `${csvEscape(k)},${csvEscape(v)}`);
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const sessionId = Number(params.id);
  if (!Number.isFinite(sessionId)) return new Response("sessionId inválido", { status: 400 });

  // 1) Sesión base (ya trae teacher_name / teacher_email si existen)
  const { data: ses, error: sErr } = await supabaseAdmin
    .from("sessions")
    .select("id, session_code, session_date, start_planned, started_at, teacher_name, teacher_email")
    .eq("id", sessionId)
    .maybeSingle();
  if (sErr) return new Response(sErr.message, { status: 500 });
  if (!ses) return new Response("Sesión no encontrada", { status: 404 });

  // 2) Attendance (alumnos)
  const { data: att, error: aErr } = await supabaseAdmin
    .from("attendance")
    .select("student_id, student_name, status, updated_at")
    .eq("session_id", sessionId)
    .order("student_id");
  if (aErr) return new Response(aErr.message, { status: 500 });

  // Conteos por estado
  const counts: Record<string, number> = { Presente: 0, Tarde: 0, Ausente: 0, Justificado: 0 };
  for (const r of att ?? []) if (r.status) counts[r.status] = (counts[r.status] ?? 0) + 1;

  // 3) Metadatos extra desde schedule_slots (room/grupo/subject por día+hora)
  const dateStr = ses.session_date as string | null;
  const plannedHHMMSS = toHHMMSS((ses.start_planned ? hhmmToTime(ses.start_planned) : undefined) || "");
  const roomGuess = roomFromSessionCode(ses.session_code);

  let groupNames: string[] = [];
  let subjects: string[] = [];
  let roomResolved: string | null = roomGuess;

  if (dateStr && plannedHHMMSS) {
    const weekday = ((new Date(`${dateStr}T00:00:00`).getDay() + 6) % 7) + 1; // 1..7 (lun..dom)
    let slots: any[] = [];

    if (roomGuess) {
      const { data, error } = await supabaseAdmin
        .from("schedule_slots")
        .select("group_name, subject, room_code, start_time, weekday")
        .eq("weekday", weekday)
        .eq("start_time", plannedHHMMSS)
        .eq("room_code", roomGuess);
      if (error) return new Response(error.message, { status: 500 });
      slots = data ?? [];
    }
    if (!slots.length) {
      const { data, error } = await supabaseAdmin
        .from("schedule_slots")
        .select("group_name, subject, room_code, start_time, weekday")
        .eq("weekday", weekday)
        .eq("start_time", plannedHHMMSS);
      if (error) return new Response(error.message, { status: 500 });
      slots = data ?? [];
    }

    if (slots.length) {
      groupNames = Array.from(new Set(slots.map((s) => String(s.group_name || "")).filter(Boolean)));
      subjects   = Array.from(new Set(slots.map((s) => String(s.subject || "")).filter(Boolean)));
      const rooms = Array.from(new Set(slots.map((s) => String(s.room_code || "")).filter(Boolean)));
      if (rooms.length === 1) roomResolved = rooms[0];
    }
  }

  // 4) CSV: metadatos + línea en blanco + detalle
  const metaLines = kvRows({
    session_id: ses.id,
    session_code: ses.session_code ?? "",
    session_date: ses.session_date ?? "",
    start_planned: ses.start_planned ? hhmmToTime(ses.start_planned) : "",
    started_at: ses.started_at ?? "",
    room: roomResolved ?? "",
    teacher_name: ses.teacher_name ?? "",
    teacher_email: ses.teacher_email ?? "",
    groups: groupNames.join(" | "),
    subjects: subjects.join(" | "),
    total_alumnos: att?.length ?? 0,
    presentes: counts.Presente,
    tardes: counts.Tarde,
    ausentes: counts.Ausente,
    justificados: counts.Justificado,
  });

  const header = ["student_id", "student_name", "status", "updated_at"];
  const detailLines = [
    header.join(","),
    ...((att ?? []).map((r) =>
      [r.student_id, r.student_name ?? "", r.status ?? "", r.updated_at ?? ""]
        .map(csvEscape).join(",")
    )),
  ];

  const csv = [...metaLines, "", ...detailLines].join("\n");

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="attendance_session_${sessionId}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
