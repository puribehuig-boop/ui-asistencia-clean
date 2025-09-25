// app/profile/page.tsx
import { createSupabaseServerClient } from "@/lib/supabase/serverClient";
import { redirect } from "next/navigation";
import ProfileTabs from "./ProfileTabs";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SessionRow = {
  id: number; session_date: string | null; start_planned: string | null;
  room_code: string | null; status: string | null; is_manual: boolean | null;
  started_at: string | null; ended_at: string | null; group_id: number | null;
};

type GroupRow = { id: number; code: string | null; subjectId: number | null };
type SubjectRow = { id: number; name: string | null };

function hhmmFrom(startPlanned?: string | null) {
  if (!startPlanned) return null;
  if (/^\d{4}$/.test(startPlanned)) return `${startPlanned.slice(0,2)}:${startPlanned.slice(2,4)}`;
  if (/^\d{2}:\d{2}/.test(startPlanned)) return startPlanned.slice(0,5);
  return null;
}
function withinPlannedWindow(sessionDate?: string | null, hhmm?: string | null, isManual?: boolean | null) {
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

  // PERFIL BÁSICO
  const { data: me } = await supabase
    .from("profiles")
    .select("email, role")
    .eq("user_id", auth.user.id)
    .maybeSingle();

  //INFO DOCENTE
  const { data: teacher } = await supabase
  .from("teacher_profile")
  .select(`
    first_name, last_name, edad, curp, rfc, direccion, plantel,
    licenciatura, cedula_lic, maestria, cedula_maest,
    doctorado, cedula_doct, estado_civil, nacionalidad
  `)
  .eq("user_id", auth.user.id)
  .maybeSingle();

return (
  <ProfileTabs
    profile={{ email: me?.email ?? auth.user.email ?? "", role: me?.role ?? "docente" }}
    classes={classes}
    subjects={distinctSubjects}
    teacher={teacher ?? null}
  />
);

  
  
  // MIS CLASES (últimos 14 días y próximos 7)
  const today = new Date();
  const from = new Date(today.getTime() - 14 * 86400000).toISOString().slice(0,10);
  const to   = new Date(today.getTime() +  7 * 86400000).toISOString().slice(0,10);

  const { data: sessions } = await supabase
  .from("sessions")
  .select("id, session_date, start_planned, room_code, status, is_manual, started_at, ended_at, group_id, subjectId") // ← agregamos subjectId (ver SQL abajo)
  .eq("teacher_user_id", auth.user.id)
  .order("session_date", { ascending: false })
  .order("id", { ascending: false })
  .limit(100);


  // Enriquecer con group/subject
  // después de leer sessions:
const groupIds = Array.from(new Set((sessions ?? []).map(s => s.group_id).filter(Boolean))) as number[];
const sessionSubjectIds = Array.from(new Set((sessions ?? []).map((s:any) => s.subjectId).filter(Boolean))) as number[];

let groupMap = new Map<number, { id:number; code:string|null; subjectId:number|null }>();
let subjectMap = new Map<number, { id:number; name:string|null }>();

if (groupIds.length) {
  const { data: groups } = await supabase.from("Group").select("id, code, subjectId").in("id", groupIds);
  (groups ?? []).forEach(g => groupMap.set(g.id, g));
}
const subjectIds = Array.from(new Set([
  ...sessionSubjectIds,
  ...Array.from(groupMap.values()).map(g => g.subjectId).filter(Boolean) as number[],
]));

if (subjectIds.length) {
  const { data: subjects } = await supabase.from("Subject").select("id, name").in("id", subjectIds);
  (subjects ?? []).forEach(s => subjectMap.set(s.id, s));
}

const classes = (sessions ?? []).map((s:any) => {
  const g = s.group_id ? groupMap.get(s.group_id) ?? null : null;
  const subjectId = s.subjectId ?? g?.subjectId ?? null;
  const subjectName = subjectId ? subjectMap.get(subjectId)?.name ?? null : null;
  // ... (lo demás igual)
  return { /* ... */, subjectName };
});

  // MIS MATERIAS (distintas por las que tiene sesiones)
  const distinctSubjects = Array.from(
    new Map(
      classes
        .filter(c => !!c.subjectName)
        .map(c => [c.subjectName!, { name: c.subjectName!, groupCode: c.groupCode }])
    ).values()
  );

  return (
    <ProfileTabs
      profile={{ email: me?.email ?? auth.user.email ?? "", role: me?.role ?? "docente" }}
      classes={classes}
      subjects={distinctSubjects}
    />
  );
}
