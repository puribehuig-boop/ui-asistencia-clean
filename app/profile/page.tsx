// app/profile/page.tsx
import { createSupabaseServerClient } from "@/lib/supabase/serverClient";
import { redirect } from "next/navigation";
import ProfileTabs from "./ProfileTabs";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SessionRow = {
  id: number;
  session_date: string | null;
  start_planned: string | null;
  room_code: string | null;
  status: string | null;
  is_manual: boolean | null;
  started_at: string | null;
  ended_at: string | null;
  group_id: number | null;
  subjectId: number | null;
};

type GroupRow = {
  id: number;
  code: string | null;
  subjectId: number | null;
  termId: number | null;
};

type SubjectRow = { id: number; name: string | null };

type TeacherRow = {
  first_name: string | null;
  last_name: string | null;
  edad: number | null;
  curp: string | null;
  rfc: string | null;
  direccion: string | null;
  plantel: string | null;
  licenciatura: string | null;
  cedula_lic: string | null;
  maestria: string | null;
  cedula_maest: string | null;
  doctorado: string | null;
  cedula_doct: string | null;
  estado_civil: string | null;
  nacionalidad: string | null;
};

function hhmmFrom(startPlanned: string | null): string | null {
  if (!startPlanned) return null;
  if (/^\d{4}$/.test(startPlanned)) return `${startPlanned.slice(0, 2)}:${startPlanned.slice(2, 4)}`;
  if (/^\d{2}:\d{2}/.test(startPlanned)) return startPlanned.slice(0, 5);
  return null;
}

function withinPlannedWindow(sessionDate: string | null, hhmm: string | null, isManual: boolean | null, endedAt: string | null) {
  if (endedAt) return false;      // ← terminó = fuera de ventana
  if (isManual) return true;
  if (!sessionDate || !hhmm) return false;
  const planned = new Date(`${sessionDate}T${hhmm}:00`);
  if (isNaN(planned.getTime())) return false;
  const now = new Date();
  const from = new Date(planned.getTime() - 30 * 60 * 1000);
  const to   = new Date(planned.getTime() + 30 * 60 * 1000);
  return now >= from && now <= to;
}

export default async function ProfilePage() {
  const supabase = createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) redirect("/login");
  const uid = auth.user.id;

  // Perfil básico
  const { data: me } = await supabase
    .from("profiles")
    .select("email, role")
    .eq("user_id", uid)
    .maybeSingle();

  // Ficha docente completa
  const { data: teacher } = await supabase
    .from("teacher_profile")
    .select(`
      first_name, last_name, edad, curp, rfc, direccion, plantel,
      licenciatura, cedula_lic, maestria, cedula_maest,
      doctorado, cedula_doct, estado_civil, nacionalidad
    `)
    .eq("user_id", uid)
    .maybeSingle<TeacherRow>();

  // Todas las sesiones del docente (máx. 100 recientes)
  const { data: sessions } = await supabase
    .from("sessions")
    .select(
      "id, session_date, start_planned, room_code, status, is_manual, started_at, ended_at, group_id, subjectId"
    )
    .eq("teacher_user_id", uid)
    .order("session_date", { ascending: false })
    .order("id", { ascending: false })
    .limit(100);

  // Mapas de Group y Subject
  const groupIds = Array.from(
    new Set((sessions ?? []).map((s: SessionRow) => s.group_id).filter((v): v is number => v != null))
  );
  const sessionSubjectIds = Array.from(
    new Set((sessions ?? []).map((s: SessionRow) => s.subjectId).filter((v): v is number => v != null))
  );

  const groupMap = new Map<number, GroupRow>();
  if (groupIds.length) {
    const { data: groups } = await supabase
      .from("Group")
      .select("id, code, subjectId, termId")
      .in("id", groupIds);
    (groups as GroupRow[] | null ?? []).forEach((g) => groupMap.set(g.id, g));
  }

  const subjectIdSet = new Set<number>();
  sessionSubjectIds.forEach((id) => subjectIdSet.add(id));
  groupMap.forEach((g) => {
    if (g.subjectId != null) subjectIdSet.add(g.subjectId);
  });
  const subjectIds = Array.from(subjectIdSet);

  const subjectMap = new Map<number, SubjectRow>();
  if (subjectIds.length) {
    const { data: subjects } = await supabase
      .from("Subject")
      .select("id, name")
      .in("id", subjectIds);
    (subjects as SubjectRow[] | null ?? []).forEach((s: any) => subjectMap.set(s.id, s));
  }

  // Construir clases enriquecidas
  const classes = (sessions as SessionRow[] | null ?? []).map((s) => {
    const group = s.group_id ? groupMap.get(s.group_id) ?? null : null;
    const resolvedSubjectId = s.subjectId ?? (group?.subjectId ?? null);
    const subjectName = resolvedSubjectId != null ? subjectMap.get(resolvedSubjectId)?.name ?? null : null;
    const time = hhmmFrom(s.start_planned);
    return {
      id: s.id,
      date: s.session_date,
      time,
      room: s.room_code,
      status: s.status,
      isManual: !!s.is_manual,
      startedAt: s.started_at,
      endedAt: s.ended_at,
      groupCode: group?.code ?? null,
      subjectName,
      withinWindow: withinPlannedWindow(s.session_date, time, s.is_manual, s.ended_at),
    };
  });

  // Mis materias (distintas, derivadas de las clases)
  const subjects = Array.from(
    new Map(
      classes
        .filter((c) => !!c.subjectName)
        .map((c) => [c.subjectName as string, { name: c.subjectName as string, groupCode: c.groupCode }])
    ).values()
  );

  return (
    <ProfileTabs
      profile={{ email: me?.email ?? auth.user.email ?? "", role: me?.role ?? "docente" }}
      classes={classes}
      subjects={subjects}
      teacher={teacher ?? null}
    />
  );
}
