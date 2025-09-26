// app/staff/control-escolar/page.tsx
import { createSupabaseServerClient } from "@/lib/supabase/serverClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ControlEscolarHome() {
  const supabase = createSupabaseServerClient();

  const [{ count: groupsCount }, { count: enrollCount }] = await Promise.all([
    supabase.from("Group").select("*", { count: "exact", head: true }),
    supabase.from("Enrollment").select("*", { count: "exact", head: true }),
  ]);

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Control escolar</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="border rounded p-3">
          <div className="text-xs opacity-60">Grupos</div>
          <div className="text-2xl font-semibold">{groupsCount ?? 0}</div>
        </div>
        <div className="border rounded p-3">
          <div className="text-xs opacity-60">Inscripciones</div>
          <div className="text-2xl font-semibold">{enrollCount ?? 0}</div>
        </div>
        <div className="border rounded p-3">
          <div className="text-xs opacity-60">Asistencia (hoy)</div>
          <div className="text-2xl font-semibold">—</div>
        </div>
      </div>

      <div className="border rounded p-4">
        <div className="text-sm font-medium mb-2">Accesos</div>
        <ul className="list-disc pl-6 text-sm space-y-1">
          <li><a href="/staff/control-escolar/asistencia" className="underline">Asistencia</a></li>
          <li><a href="/staff/control-escolar/calificaciones" className="underline">Calificaciones</a></li>
        </ul>
      </div>
    </div>
  );
}
