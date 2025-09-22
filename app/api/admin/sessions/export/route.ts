import { isAdminUser } from "@/lib/auth/isAdmin";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function todayMX() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function esc(s: any) {
  const v = (s ?? "").toString();
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

export async function GET(req: Request) {
  if (!(await isAdminUser())) {
    return new NextResponse("unauthorized", { status: 401 });
  }

  const url = new URL(req.url);
  const date = url.searchParams.get("date") || todayMX();
  const room = url.searchParams.get("room") || "";
  const group = url.searchParams.get("group") || "";

  let q = supabaseAdmin
    .from("sessions")
    .select(
      "id, session_code, session_date, room_code, subject, group_name, start_planned, end_planned, started_at, ended_at, status, arrival_status, arrival_delay_min"
    )
    .eq("session_date", date)
    .order("start_planned", { ascending: true, nullsFirst: true })
    .order("room_code", { ascending: true });

  if (room) q = q.ilike("room_code", `%${room}%`);
  if (group) q = q.ilike("group_name", `%${group}%`);

  const { data: sessions, error: errSes } = await q;
  if (errSes) return new NextResponse("error: " + errSes.message, { status: 500 });

  const header = [
    "session_code","session_date","room_code","subject","group_name",
    "start_planned","end_planned","status","arrival_status","arrival_delay_min",
    "started_at","ended_at",
    "student_id","student_name","attendance_status","attendance_updated_at","attendance_updated_by"
  ].join(",");

  if (!sessions || sessions.length === 0) {
    return new NextResponse(header + "\n", {
      status: 200,
      headers: { "Content-Type": "text/csv; charset=utf-8",
                 "Content-Disposition": `attachment; filename="asistencias_${date}.csv"` },
    });
  }

  const ids = sessions.map((s) => s.id);
  const { data: attendance, error: errAtt } = await supabaseAdmin
    .from("attendance")
    .select("session_id, student_id, student_name, status, updated_at, updated_by")
    .in("session_id", ids);

  if (errAtt) return new NextResponse("error: " + errAtt.message, { status: 500 });

  const attBySession = new Map<number, any[]>();
  for (const a of attendance ?? []) {
    const arr = attBySession.get(a.session_id) ?? [];
    arr.push(a);
    attBySession.set(a.session_id, arr);
  }

  const lines = [header];
  for (const s of sessions) {
    const rows = attBySession.get(s.id) ?? [];
    if (rows.length === 0) {
      lines.push([
        esc(s.session_code), esc(s.session_date), esc(s.room_code), esc(s.subject), esc(s.group_name),
        esc(s.start_planned), esc(s.end_planned), esc(s.status), esc(s.arrival_status), esc(s.arrival_delay_min),
        esc(s.started_at), esc(s.ended_at),
        "", "", "", "", ""
      ].join(","));
    } else {
      for (const a of rows) {
        lines.push([
          esc(s.session_code), esc(s.session_date), esc(s.room_code), esc(s.subject), esc(s.group_name),
          esc(s.start_planned), esc(s.end_planned), esc(s.status), esc(s.arrival_status), esc(s.arrival_delay_min),
          esc(s.started_at), esc(s.ended_at),
          esc(a.student_id), esc(a.student_name), esc(a.status), esc(a.updated_at), esc(a.updated_by)
        ].join(","));
      }
    }
  }

  const csv = lines.join("\n") + "\n";
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="asistencias_${date}.csv"`,
    },
  });
}
