// app/staff/control-escolar/profesores/page.tsx
import supabaseAdmin from "@/lib/supabase/adminClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ProfesSearchPage({ searchParams }: { searchParams?: { q?: string } }) {
  const q = (searchParams?.q ?? "").trim();

  const profs = await supabaseAdmin
    .from("profiles")
    .select("user_id, email, role")
    .eq("role", "docente")
    .ilike("email", q ? `%${q}%` : "%")
    .order("email", { ascending: true });

  // Mostrar nombre desde teacher_profile si existe
  let names: Record<string, string> = {};
  const ids = (profs.data ?? []).map(r => r.user_id);
  if (ids.length) {
    const { data: tps } = await supabaseAdmin
      .from("teacher_profile")
      .select("user_id, first_name, last_name")
      .in("user_id", ids);
    (tps ?? []).forEach((t: any) => {
      names[t.user_id] = [t.first_name, t.last_name].filter(Boolean).join(" ");
    });
  }

  const rows = (profs.data ?? []).map(r => ({
    user_id: r.user_id,
    email: r.email,
    name: names[r.user_id] || "",
  }));

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Profesores</h1>

      <form className="flex flex-wrap items-center gap-2">
        <input name="q" defaultValue={q} placeholder="Buscar por correo…" className="px-2 py-1 border rounded" />
        <button className="px-3 py-1 border rounded" type="submit">Buscar</button>
      </form>

      <div className="border rounded">
        <div className="grid grid-cols-12 bg-gray-50 px-3 py-2 text-sm font-medium">
          <div className="col-span-5 text-black">Profesor</div>
          <div className="col-span-5 text-black">Correo</div>
          <div className="col-span-2 text-black">Acciones</div>
        </div>
        <div>
          {rows.map(r => (
            <div key={r.user_id} className="grid grid-cols-12 border-t px-3 py-2 text-sm items-center">
              <div className="col-span-5">{r.name || "—"}</div>
              <div className="col-span-5 break-words">{r.email}</div>
              <div className="col-span-2">
                <a className="px-2 py-1 border rounded text-xs" href={`/staff/control-escolar/profesores/${r.user_id}`}>Ver</a>
              </div>
            </div>
          ))}
          {!rows.length && <div className="p-4 text-sm opacity-70">Sin resultados.</div>}
        </div>
      </div>
    </div>
  );
}
