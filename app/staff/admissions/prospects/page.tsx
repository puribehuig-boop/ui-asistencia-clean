import { createSupabaseServerClient } from "@/lib/supabase/serverClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ProspectsListPage() {
  const supabase = createSupabaseServerClient();

  // Guard
  const { data: auth } = await supabase.auth.getUser();
  const { data: me } = await supabase.from("profiles").select("role").eq("user_id", auth?.user?.id ?? "").maybeSingle();
  const role = (me?.role ?? "").toLowerCase();
  if (!["admin","admissions"].includes(role)) {
    return <div className="p-6">No tienes acceso.</div>;
  }

  const { data: rows } = await supabase
    .from("prospects")
    .select("id, full_name, email, phone, source, campaign, stage, owner_user_id, created_at")
    .order("created_at", { ascending: false })
    .limit(500);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Admisiones · Prospectos</h1>
        <a href="/staff/admissions/kanban" className="text-sm underline">Ver Kanban</a>
      </div>

      <div className="border rounded overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-3 py-2">Nombre</th>
              <th className="text-left px-3 py-2">Email</th>
              <th className="text-left px-3 py-2">Teléfono</th>
              <th className="text-left px-3 py-2">Etapa</th>
              <th className="text-left px-3 py-2">Origen/Campaña</th>
              <th className="text-left px-3 py-2">Creado</th>
              <th className="text-left px-3 py-2">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {(rows ?? []).map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-3 py-2">{r.full_name}</td>
                <td className="px-3 py-2">{r.email ?? "—"}</td>
                <td className="px-3 py-2">{r.phone ?? "—"}</td>
                <td className="px-3 py-2">{r.stage}</td>
                <td className="px-3 py-2">{r.source ?? "—"} {r.campaign ? `· ${r.campaign}` : ""}</td>
                <td className="px-3 py-2">{new Date(r.created_at).toLocaleString()}</td>
                <td className="px-3 py-2">
                  <a className="text-xs underline" href={`/staff/admissions/prospects/${r.id}`}>Abrir</a>
                </td>
              </tr>
            ))}
            {(!rows || !rows.length) && (
              <tr><td className="px-3 py-4 opacity-70" colSpan={7}>Sin prospectos aún.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
