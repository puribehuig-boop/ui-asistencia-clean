// app/teacher/sessions/[id]/page.tsx
import { createSupabaseServerClient } from "@/lib/supabase/serverClient";
import { redirect } from "next/navigation";
import Roster from "./Roster";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SessionRow = {
  id: number;
  session_date: string | null;
  start_planned: string | null;
  is_manual: boolean | null;
  started_at: string | null;
  ended_at: string | null;
  group_id: number | null;
  teacher_user_id: string | null;
  session_code: string | null;
  room_code: string | null;
};

type GroupRow = { id: number; code: string | null; termId: number | null };
type TermRow = { id: number; name: string | null };

function hhmmFromStart(startPlanned?: string | null, slotStart?: string | null) {
  if (startPlanned) {
    if (/^\d{4}$/.test(startPlanned)) return `${startPlanned.slice(0, 2)}:${startPlanned.slice(2, 4)}`;
    if (/^\d{2}:\d{2}/.test(startPlanned)) return startPlanned.slice(0,5);
  }
  if (slotStart) return slotStart.slice(0, 5);
  return null;
}
function plannedDateFrom(sessionDate?: string | null, hhmm?: string | null) {
  if (!sessionDate || !hhmm) return null;
  const d = new Date(`${sessionDate}T${hhmm}:00`);
  return isNaN(d.getTime()) ? null : d;
}
function isWithinWindow(now: Date, planned: Date | null, isManual: boolean | null, minutes = 30) {
  if (isManual) return true;
  if (!planned) return false;
  const from = new Date(planned.getTime() - minutes * 60 * 1000);
  const to = new Date(planned.getTime() + minutes * 60 * 1000);
  return now >= from && now <= to;
}
function weekday1_7(d: Date) { return ((d.getDay() + 6) % 7) + 1; }

export default async function SessionPage({ params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) redirect("/login");

  const sid = Number(params.id);
  if (!Number.isFinite(sid)) return <div className="p-6 text-red-600">ID de sesión inválido.</div>;

  const { data: s, error: sErr } = await supabase
    .from("sessions")
    .select("id, session_date, start_planned, is_manual, started_at, ended_at, group_id, teacher_user_id, session_code, room_code")
    .eq("id", sid)
    .maybeSingle<SessionRow>();
  if (sErr) return <div className="p-6 text-red-600">Error cargando sesión: {sErr.message}</div>;
  if (!s) return <div className="p-6">Sesión no encontrada.</div>;

  let group: GroupRow | null = null;
  let term: TermRow | null = null;
  let slotStart: string | null = null;

  if (s.group_id) {
    const { data: g } = await supabase.from("Group").select("id, code, termId").eq("id", s.group_id).maybeSingle<GroupRow>();
    group = g ?? null;
    if (group?.termId) {
      const { data: tt } = await supabase.from("Term").select("id, name").eq("id", group.termId).maybeSingle<TermRow>();
      term = tt ?? null;
    }
    if (s.session_date) {
      const dow = weekday1_7(new Date(s.session_date));
      const { data: sl } = await supabase
        .from("schedule_slots")
        .select("start_time")
        .eq("group_id", s.group_id)
        .eq("weekday", dow)
        .order("start_time", { ascending: true })
        .limit(1)
        .maybeSingle<{ start_time: string | null }>();
      slotStart = sl?.start_time ?? null;
    }
  }

  const hhmm = hhmmFromStart(s.start_planned, slotStart);
  const planned = plannedDateFrom(s.session_date, hhmm);
  const within = isWithinWindow(new Date(), planned, !!s.is_manual, 30);
  const canStart = !s.started_at && within;
  const canFinish = !!s.started_at && !s.ended_at && within;

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Sesión #{s.id}</h1>
          <p className="text-sm opacity-70">
            {s.session_date ? new Date(s.session_date).toLocaleDateString() : "Sin fecha"}
            {" · "} {hhmm ?? "Sin hora planificada"} {" · "}
            {s.room_code ? `Salón ${s.room_code}` : "Salón —"}
          </p>
          <p className="text-sm opacity-70">
            {group?.code ? `Grupo ${group.code}` : "Grupo —"}
            {term?.name ? ` · Periodo ${term.name}` : ""}
            {s.is_manual ? " · Sesión manual" : ""}
          </p>
          <p className="text-sm">
            {s.started_at ? <>Inicio real: <b>{new Date(s.started_at).toLocaleString()}</b></> : "Sin inicio real"}
            {" · "}
            {s.ended_at ? <>Fin real: <b>{new Date(s.ended_at).toLocaleString()}</b></> : "Sin fin real"}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <form action="/api/sessions/start" method="post">
            <input type="hidden" name="session_id" value={s.id} />
            <button type="submit" className="px-3 py-2 rounded border shadow-sm disabled:opacity-50"
              disabled={!canStart}
              title={s.is_manual ? "" : "Disponible ±30 min respecto a la hora planificada"}>
              Iniciar clase
            </button>
          </form>

          <form action="/api/sessions/finish" method="post">
            <input type="hidden" name="session_id" value={s.id} />
            <button type="submit" className="px-3 py-2 rounded border shadow-sm disabled:opacity-50"
              disabled={!canFinish}
              title={s.is_manual ? "" : "Disponible ±30 min respecto a la hora planificada"}>
              Finalizar clase
            </button>
          </form>
        </div>
      </header>

      {/* ✅ Roster + acciones de asistencia */}
      <section className="space-y-2">
        <h2 className="text-lg font-medium">Alumnos</h2>
        <Roster sessionId={s.id} groupId={s.group_id} />
      </section>
    </div>
  );
}
