// app/staff/control-escolar/asistencia/page.tsx
import { createSupabaseServerClient } from "@/lib/supabase/serverClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function StaffAttendancePage() {
  const supabase = createSupabaseServerClient();

  const since = new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const { data: sessions } = await supabase
    .from("sessions")
    .select("id, session_date, room_code, status, group_id, subjectId")
    .gte("session_date", since)
    .order("session_date", { ascending: false })
    .order("id", { ascending: false })
    .limit(20);

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Asistencia</h1>
      <div className="border rounded">
        <div className="grid grid-cols-12 bg-gray-50 px-3 py-2 text-sm font-medium">
          <div className="col-span-2 text-black">Fecha</div>
          <div className="col-span-2 text-black">Salón</div>
          <div className="col-span-2 text-black">Estado</div>
          <div className="col-span-6 text-black">Info</div>
        </div>
        <div>
          {(sessions ?? []).map((s) => (
            <div key={s.id} className="grid grid-cols-12 border-t px-3 py-2 text-sm">
              <div className="col-span-2">{s.session_date ?? "—"}</div>
              <div className="col-span-2">{s.room_code ?? "—"}</div>
              <div className="col-span-2">{s.status ?? "—"}</div>
              <div className="col-span-6">Sesión #{s.id} · Grupo {s.group_id ?? "—"} · MateriaId {s.subjectId ?? "—"}</div>
            </div>
          ))}
          {(!sessions || !sessions.length) && (
            <div className="p-4 text-sm opacity-70">Sin sesiones recientes.</div>
          )}
        </div>
      </div>
    </div>
  );
}
