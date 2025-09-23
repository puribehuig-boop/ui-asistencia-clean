import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/adminClient";

export const runtime = "nodejs";

// JS Sunday=0...Saturday=6 -> queremos Monday=1...Sunday=7
function jsDayToIsoMon1Sun7(d: number) { return ((d + 6) % 7) + 1; }
function hhmmToTime(hhmm?: string | null) {
  if (!hhmm) return "";
  const m = hhmm.match(/^(\d{2})(\d{2})$/);
  if (!m) return hhmm;
  return `${m[1]}:${m[2]}`;
}
function toHHMMSS(s?: string | null) {
  if (!s) return "";
  if (/^\d{2}:\d{2}:\d{2}$/.test(s)) return s;
  if (/^\d{2}:\d{2}$/.test(s)) return `${s}:00`;
  if (/^\d{4}$/.test(s)) return `${s.slice(0,2)}:${s.slice(2)}:00`;
  return s;
}
function roomFromSessionCode(code?: string | null): string | null {
  if (!code) return null;
  // "A-101-20250923-0800" -> "A-101"
  const toks = code.split("-");
  const iDate = toks.findIndex(t => /^\d{8}$/.test(t));
  if (iDate > 0) return toks.slice(0, iDate).join("-");
  return toks[0] || null;
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const sessionId = Number(params.id);
  if (!Number.isFinite(sessionId)) {
    return NextResponse.json({ ok: false, error: "sessionId inválido" }, { status: 400 });
  }

  // 1) Sesión base
  const { data: ses, error: sErr } = await supabaseAdmin
    .from("sessions")
    .select("id, session_code, session_date, start_planned, started_at")
    .eq("id", sessionId)
    .maybeSingle();
  if (sErr) return NextResponse.json({ ok: false, error: sErr.message }, { status: 500 });
  if (!ses) return NextResponse.json({ ok: false, error: "Sesión no encontrada" }, { status: 404 });

  // Fecha / hora de inicio (preferir start_planned)
  const dateStr = ses.session_date as string | null;
  const jsDate = dateStr ? new Date(`${dateStr}T00:00:00`) : (ses.started_at ? new Date(ses.started_at) : new Date());
  const weekday = jsDayToIsoMon1Sun7(jsDate.getDay());
  const plannedHH = toHHMMSS((ses.start_planned ? hhmmToTime(ses.start_planned) : undefined) || "");
  const maybeRoom = roomFromSessionCode(ses.session_code);

  // 2) Intentar hallar schedule_slots por weekday + start_time (+ room_code si podemos)
  let slots: any[] = [];
  if (maybeRoom && plannedHH) {
    const { data, error } = await supabaseAdmin
      .from("schedule_slots")
      .select("id, room_code, group_name, start_time, weekday")
      .eq("weekday", weekday)
      .eq("start_time", plannedHH)
      .eq("room_code", maybeRoom);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    slots = data ?? [];
  }
  if ((!slots || slots.length === 0) && plannedHH) {
    const { data, error } = await supabaseAdmin
      .from("schedule_slots")
      .select("id, room_code, group_name, start_time, weekday")
      .eq("weekday", weekday)
      .eq("start_time", plannedHH);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    slots = data ?? [];
  }

  // 3) Resolver group_id(s) por nombre en "Group"
  let groupIds: number[] = [];
  if (slots.length > 0) {
    const groupNames = Array.from(new Set(slots.map(s => String(s.group_name || "")).filter(Boolean)));
    if (groupNames.length > 0) {
      const { data: groups, error: gErr } = await supabaseAdmin
        .from("Group")
        .select("id, name")
        .in("name", groupNames);
      if (gErr) return NextResponse.json({ ok: false, error: gErr.message }, { status: 500 });
      groupIds = (groups ?? []).map((g: any) => Number(g.id)).filter(Number.isFinite);
    }
  }

  // 4) Alumnos por Enrollment (si hay grupos); si no, caeremos a attendance
  let enrollmentIds: number[] = [];
  if (groupIds.length > 0) {
    const { data: enr, error: eErr } = await supabaseAdmin
      .from("Enrollment")
      .select("student_id")
      .in("group_id", groupIds);
    if (eErr) return NextResponse.json({ ok: false, error: eErr.message }, { status: 500 });
    enrollmentIds = (enr ?? []).map((r: any) => Number(r.student_id)).filter(Number.isFinite);
  }

  // 5) Nombres desde StudentProfile (opcional)
  const namesById = new Map<number, string>();
  if (enrollmentIds.length > 0) {
    const { data: profs, error: pErr } = await supabaseAdmin
      .from("StudentProfile")
      .select("student_id, id, full_name, name")
      .in("student_id", enrollmentIds);
    if (pErr) return NextResponse.json({ ok: false, error: pErr.message }, { status: 500 });
    for (const p of profs ?? []) {
      const sid = Number(p.student_id ?? p.id);
      const nm = (p.full_name ?? p.name ?? "").toString();
      if (Number.isFinite(sid)) namesById.set(sid, nm);
    }
  }

  // 6) Asistencia actual
  const { data: att, error: aErr } = await supabaseAdmin
    .from("attendance")
    .select("student_id, student_name, status, updated_at")
    .eq("session_id", sessionId);
  if (aErr) return NextResponse.json({ ok: false, error: aErr.message }, { status: 500 });

  const attById = new Map<number, { name: string; status: string; updated_at: string | null }>();
  for (const r of att ?? []) {
    const sid = Number(r.student_id);
    if (!Number.isFinite(sid)) continue;
    attById.set(sid, { name: r.student_name ?? "", status: r.status ?? "", updated_at: r.updated_at ?? null });
  }

  // 7) Construir lista final
  let items: any[] = [];
  if (enrollmentIds.length > 0) {
    items = enrollmentIds.map((sid) => {
      const a = attById.get(sid);
      return {
        student_id: sid,
        student_name: (a?.name || namesById.get(sid) || "").toString(),
        status: a?.status || "",
        updated_at: a?.updated_at || null,
      };
    });
  } else {
    // Fallback: los ya marcados en esta sesión
    items = (att ?? []).map((r: any) => ({
      student_id: Number(r.student_id),
      student_name: (r.student_name ?? "").toString(),
      status: r.status ?? "",
      updated_at: r.updated_at ?? null,
    }));
  }

  items.sort((a, b) => (a.student_name || "").localeCompare(b.student_name || "") || a.student_id - b.student_id);
  return NextResponse.json({
    ok: true,
    items,
    meta: { matchedSlots: slots.length, usedRoom: !!maybeRoom }
  });
}
