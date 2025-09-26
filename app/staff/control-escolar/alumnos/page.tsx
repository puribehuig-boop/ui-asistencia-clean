// app/staff/control-escolar/alumnos/page.tsx
import supabaseAdmin from "@/lib/supabase/adminClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AlumnosSearchPage({ searchParams }: { searchParams?: { q?: string } }) {
  const q = (searchParams?.q ?? "").trim();

  // Buscamos por email en profiles (rol alumno/student) y por fullName en StudentProfile
  // Nota: adminClient evita RLS y permite joins libres
  const emails = await supabaseAdmin
    .from("profiles")
    .select("user_id, email, role")
    .in("role", ["alumno","student"])
    .ilike("email", q ? `%${q}%` : "%")
    .order("email", { ascending: true });

  // Pluck ids
  const ids = (emails.data ?? []).map(r => r.user_id);

  // Tomar nombres desde StudentProfile para esos user_ids
  let names: Record<string, string> = {};
  if (ids.length) {
    const sp = await supabaseAdmin
      .from("StudentProfile")
      .select('userId, fullName, "first_name", "last_name"')
      .in("userId", ids.map((id: string) => id));
    (sp.data ?? []).forEach((row: any) => {
      const fn = row.fullName || [row.first_name, row.last_name].filter(Boolean).join(" ");
      names[row.userId] = fn || "";
    });
  }

  const rows = (emails.data ?? []).map(r => ({
    user_id: r.user_id,
    email: r.email,
    name: names[r.user_id] || "",
    role: r.role,
  }));

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Alumnos</h1>

      <form className="flex flex-wrap items-center gap-2">
        <input name="q" defaultValue={q} placeholder="Buscar por correo…" className="px-2 py-1 border rounded" />
        <button className="px-3 py-1 border rounded" type="submit">Buscar</button>
      </form>

      <div className="border rounded">
        <div className="grid grid-cols-12 bg-gray-50 px-3 py-2 text-sm font-medium">
          <div className="col-span-5 text-black">Alumno</div>
          <div className="col-span-5 text-black">Correo</div>
          <div className="col-span-2 text-black">Acciones</div>
        </div>
        <div>
          {rows.map(r => (
            <div key={r.user_id} className="grid grid-cols-12 border-t px-3 py-2 text-sm items-center">
              <div className="col-span-5">{r.name || "—"}</div>
              <div className="col-span-5 break-words">{r.email}</div>
              <div className="col-span-2">
                <a className="px-2 py-1 border rounded text-xs" href={`/staff/control-escolar/alumnos/${r.user_id}`}>Ver</a>
              </div>
            </div>
          ))}
          {!rows.length && <div className="p-4 text-sm opacity-70">Sin resultados.</div>}
        </div>
      </div>
    </div>
  );
}
