// app/api/teacher/sessions/[id]/roster/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/adminClient";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const sessionId = Number(params.id);
  if (!Number.isFinite(sessionId)) {
    return NextResponse.json({ ok: false, error: "sessionId inválido" }, { status: 400 });
  }

  // 1) Traer la sesión con su schedule_slot_id (si existe)
  const { data: ses, error: sErr } = await supabaseAdmin
    .from("sessions")
    .select("id, session_date, start_planned, started_at, schedule_slot_id")
    .eq("id", sessionId)
    .maybeSingle();
  if (sErr) return NextResponse.json({ ok: false, error: sErr.message }, { status: 500 });
  if (!ses) return NextResponse.json({ ok: false, error: "Sesión no encontrada" }, { status: 404 });

  // 2) Resolver group_id vía schedule_slots (si existe la relación)
  let groupId: number | null = null;
  if (ses.schedule_slot_id != null) {
    const { data: slot, error: slErr } = await supabaseAdmin
      .from("schedule_slots")
      .select("id, group_id")
      .eq("id", ses.schedule_slot_id)
      .maybeSingle();
    if (slErr) return NextResponse.json({ ok: false, error: slErr.message }, { status: 500 });
    groupId = slot?.group_id ?? null;
  }

  // 3) Obtener los student_id ligados al grupo (Enrollment) si hay groupId
  let enrollmentIds: number[] = [];
  if (groupId != null) {
    const { data: enr, error: eErr } = await supabaseAdmin
      .from("Enrollment") // respeta tu tabla con mayúsculas
      .select("student_id")
      .eq("group_id", groupId);
    if (eErr) return NextResponse.json({ ok: false, error: eErr.message }, { status: 500 });
    enrollmentIds = (enr ?? []).map((r: any) => Number(r.student_id)).filter(Number.isFinite);
  }

  // 4) Cargar nombres desde StudentProfile (si existen)
  let namesById = new Map<number, string>();
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

  // 5) Asistencia actual de la sesión
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

  // 6) Construir roster
  let items: any[] = [];
  if (enrollmentIds.length > 0) {
    items = enrollmentIds.map((sid) => {
      const attRow = attById.get(sid);
      return {
        student_id: sid,
        student_name: (attRow?.name || namesById.get(sid) || "").toString(),
        status: attRow?.status || "",
        updated_at: attRow?.updated_at || null,
      };
    });
  } else {
    // Fallback: si no hay group, usar los que ya tengan attendance
    items = (att ?? []).map((r: any) => ({
      student_id: Number(r.student_id),
      student_name: (r.student_name ?? "").toString(),
      status: r.status ?? "",
      updated_at: r.updated_at ?? null,
    }));
  }

  // Ordenar por nombre, luego por id
  items.sort((a, b) => (a.student_name || "").localeCompare(b.student_name || "") || a.student_id - b.student_id);

  return NextResponse.json({ ok: true, items });
}
