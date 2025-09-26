// app/staff/page.tsx
import { createSupabaseServerClient } from "@/lib/supabase/serverClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function StaffHome() {
  const supabase = createSupabaseServerClient();

  // Contadores simples (usa head:true para no traer filas)
  const [{ count: leadsCount }] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }), // placeholder
  ]);

  const [{ count: groupsCount }, { count: enrollCount }] = await Promise.all([
    supabase.from("Group").select("*", { count: "exact", head: true }),
    supabase.from("Enrollment").select("*", { count: "exact", head: true }),
  ]);

  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const { data: sessions } = await supabase
    .from("sessions")
    .select("id, session_date, room_code, status, group_id, subjectId")
    .gte("session_date", since)
    .order("session_date", { ascending: false })
    .order("id", { ascending: false })
    .limit(10);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Panel de Staff</h1>

      <section>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="border rounded p-3">
            <div className="text-xs opacity-60">Leads / Usuarios (placeholder)</div>
            <div className="text-2xl font-semibold">{leadsCount ?? 0}</div>
          </div>
          <div className="border rounded p-3">
            <div className="text-xs opacity-60">Grupos</div>
            <div className="text-2xl font-semibold">{groupsCount ?? 0}</div>
          </div>
          <div className="border rounded p-3">
            <div className="text-xs opacity-60">Inscripciones</div>
            <div className="text-2xl font-semibold">{enrollCount ?? 0}</div>
          </div>
          <div className="border rounded p-3">
            <div className="text-xs opacity-60">Sesiones recientes</div>
            <div className="text-2xl font-semibold">{(sessions ?? []).length}</div>
          </div>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="font-medium">Sesiones (últimos 7 días)</h2>
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
                <div className="col-span-6">
                  Sesión #{s.id} · Grupo: {s.group_id ?? "—"} · MateriaId: {s.subjectId ?? "—"}
                </div>
              </div>
            ))}
            {(!sessions || !sessions.length) && (
              <div className="p-4 text-sm opacity-70">No hay sesiones en los últimos 7 días.</div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
