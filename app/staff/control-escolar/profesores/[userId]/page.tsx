// app/staff/control-escolar/profesores/[userId]/page.tsx
import { supabaseAdmin } from "@/lib/supabase/adminClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function hhmm(t?: string | null) {
  if (!t) return "—";
  if (/^\d{4}$/.test(t)) return `${t.slice(0,2)}:${t.slice(2,4)}`;
  if (/^\d{2}:\d{2}/.test(t)) return t.slice(0,5);
  return t;
}

export default async function TeacherDetailPage({ params }: { params: { userId: string } }) {
  const userId = params.userId;

  const [{ data: prof }, { data: tp }] = await Promise.all([
    supabaseAdmin.from("profiles").select("email, role").eq("user_id", userId).maybeSingle(),
    supabaseAdmin.from("teacher_profile").select("*").eq("user_id", userId).maybeSingle(),
  ]);

  const name = [tp?.first_name, tp?.last_name].filter(Boolean).join(" ") || prof?.email || "—";

  // Sesiones impartidas (horarios + asistencia agregada)
  const { data: sessions } = await supabaseAdmin
    .from("sessions")
    .select("id, session_date, start_planned, room_code, status, group_id, subjectId, started_at, ended_at")
    .eq("teacher_user_id", userId)
    .order("session_date", { ascending: false })
    .order("id", { ascending: false })
    .limit(100);

  // Map nombres de materia
  const subjectIds = Array.from(new Set((sessions ?? []).map((s: any) => s.subjectId).filter(Boolean)));
  const subjectMap = new Map<number, string>();
  if (subjectIds.length) {
    const { data: subs } = await supabaseAdmin.from("Subject").select("id, name").in("id", subjectIds);
    (subs ?? []).forEach((s: any) => subjectMap.set(s.id, s.name ?? ""));
  }

  const sessionsView = (sessions ?? []).map((s: any) => ({
    id: s.id,
    date: s.session_date ?? null,
    time: hhmm(s.start_planned ?? null),
    room: s.room_code ?? null,
    status: s.status ?? null,
    subjectName: s.subjectId ? (subjectMap.get(s.subjectId) ?? null) : null,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Profesor: {name}</h1>
        <div className="text-sm opacity-70">{prof?.email ?? "—"} · Rol: {prof?.role ?? "—"}</div>
      </div>

      <div className="flex flex-wrap gap-2 border-b pb-2 text-sm">
        <a href="#asistencia" className="px-2 py-1 rounded border">Asistencia</a>
        <a href="#info" className="px-2 py-1 rounded border">Información y documentos</a>
        <a href="#horarios" className="px-2 py-1 rounded border">Horarios</a>
      </div>

      <section id="asistencia" className="space-y-3">
        <h2 className="font-medium">Asistencia (resumen por sesión)</h2>
        <div className="border rounded">
          <div className="grid grid-cols-12 bg-gray-50 px-3 py-2 text-sm font-medium">
            <div className="col-span-3 text-black">Fecha</div>
            <div className="col-span-3 text-black">Materia</div>
            <div className="col-span-3 text-black">Salón</div>
            <div className="col-span-3 text-black">Estado</div>
          </div>
          <div>
            {sessionsView.map(s => (
              <div key={s.id} className="grid grid-cols-12 border-t px-3 py-2 text-sm">
                <div className="col-span-3">{s.date ?? "—"} · {s.time ?? "—"}</div>
                <div className="col-span-3">{s.subjectName ?? "—"}</div>
                <div className="col-span-3">{/* salón viene de sessions.room_code */}—</div>
                <div className="col-span-3">{s.status ?? "—"}</div>
              </div>
            ))}
            {!sessionsView.length && <div className="p-4 text-sm opacity-70">Sin sesiones.</div>}
          </div>
        </div>
      </section>

      <section id="info" className="space-y-3">
        <h2 className="font-medium">Información y documentos</h2>
        <div className="border rounded p-3 text-sm">
          <div><b>Nombre:</b> {name}</div>
          <div><b>Correo:</b> {prof?.email ?? "—"}</div>
          <div className="text-xs opacity-60 mt-2">Documentos: <i>(placeholder)</i></div>
        </div>
      </section>

      <section id="horarios" className="space-y-3">
        <h2 className="font-medium">Horarios</h2>
        <div className="border rounded">
          <div className="grid grid-cols-12 bg-gray-50 px-3 py-2 text-sm font-medium">
            <div className="col-span-3 text-black">Fecha</div>
            <div className="col-span-3 text-black">Materia</div>
            <div className="col-span-3 text-black">Hora</div>
            <div className="col-span-3 text-black">Estado</div>
          </div>
          <div>
            {sessionsView.map(s => (
              <div key={s.id} className="grid grid-cols-12 border-t px-3 py-2 text-sm">
                <div className="col-span-3">{s.date ?? "—"}</div>
                <div className="col-span-3">{s.subjectName ?? "—"}</div>
                <div className="col-span-3">{s.time ?? "—"}</div>
                <div className="col-span-3">{s.status ?? "—"}</div>
              </div>
            ))}
            {!sessionsView.length && <div className="p-4 text-sm opacity-70">Sin sesiones.</div>}
          </div>
        </div>
      </section>
    </div>
  );
}
