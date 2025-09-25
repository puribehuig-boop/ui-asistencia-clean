// app/admin/users/page.tsx
import { createSupabaseServerClient } from "@/lib/supabase/serverClient";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams?: { q?: string; role?: string };
}) {
  const supabase = createSupabaseServerClient();
  const q = (searchParams?.q ?? "").trim();
  const role = (searchParams?.role ?? "").trim();

  let query = supabase.from("profiles").select("user_id, email, role").order("email", { ascending: true }).limit(100);

  if (q) query = query.ilike("email", `%${q}%`);
  if (role) query = query.eq("role", role);

  const { data: rows } = await query;

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Usuarios</h1>

      <form className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Buscar por email…"
          className="px-2 py-1 border rounded"
        />
        <select name="role" defaultValue={role} className="px-2 py-1 border rounded">
          <option value="">Todos los roles</option>
          <option value="admin">admin</option>
          <option value="docente">docente</option>
          <option value="alumno">alumno</option>
          <option value="student">student</option>
        </select>
        <button className="px-3 py-1 border rounded" type="submit">Filtrar</button>
      </form>

      <div className="border rounded">
        <div className="grid grid-cols-12 bg-gray-50 px-3 py-2 text-sm font-medium">
          <div className="col-span-6 text-black">Email</div>
          <div className="col-span-3 text-black">Rol</div>
          <div className="col-span-3 text-black">Acciones</div>
        </div>
        <div>
          {(rows ?? []).map((r) => (
            <div key={r.user_id} className="grid grid-cols-12 border-t px-3 py-2 text-sm items-center">
              <div className="col-span-6 break-words">{r.email}</div>
              <div className="col-span-3">{r.role ?? "—"}</div>
              <div className="col-span-3">
                {/* Enlaces de ejemplo (ajusta a tus rutas reales) */}
                <Link href={`/admin/user/${r.user_id}`} className="px-2 py-1 border rounded text-xs mr-2">
                  Ver
                </Link>
                <Link href={`/admin/user/${r.user_id}/roles`} className="px-2 py-1 border rounded text-xs">
                  Rol
                </Link>
              </div>
            </div>
          ))}
          {(!rows || !rows.length) && <div className="p-4 text-sm opacity-70">Sin usuarios.</div>}
        </div>
      </div>
    </div>
  );
}
