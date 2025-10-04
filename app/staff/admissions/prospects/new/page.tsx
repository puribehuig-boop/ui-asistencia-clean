// app/staff/admissions/prospects/new/page.tsx
import { createSupabaseServerClient } from "@/lib/supabase/serverClient";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function NewProspectPage({
  searchParams,
}: {
  searchParams?: { error?: string; email?: string; phone?: string; full_name?: string };
}) {
  const supabase = createSupabaseServerClient();

  // Guard SSR
  const { data: auth } = await supabase.auth.getUser();
  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", auth?.user?.id ?? "")
    .maybeSingle();

  const role = (me?.role ?? "").toLowerCase();
  if (!["admin", "admissions"].includes(role)) {
    return (
      <div className="p-6">
        No tienes acceso. <Link href="/staff" className="underline">Volver</Link>
      </div>
    );
  }

  const error = searchParams?.error ?? "";
  const email = searchParams?.email ?? "";
  const phone = searchParams?.phone ?? "";
  const full_name = searchParams?.full_name ?? "";

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Nuevo prospecto</h1>
        <Link href="/staff/admissions/prospects" className="text-sm underline">
          Ver lista
        </Link>
      </div>

      {error && (
        <div className="border border-red-300 bg-red-50 text-red-800 rounded p-2 text-sm">
          {decodeURIComponent(error)}
        </div>
      )}

      <form
        method="post"
        action="/api/staff/admissions/prospects/create"
        className="border rounded p-4 space-y-3 max-w-xl"
      >
        <div className="text-sm opacity-70">
          Ingresa <b>email</b> y/o <b>teléfono</b>. Validaremos duplicados antes de crear.
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="md:col-span-2">
            <div className="text-xs opacity-60">Nombre completo (opcional)</div>
            <input
              name="full_name"
              defaultValue={full_name}
              className="w-full border rounded px-2 py-1"
              placeholder="Ej. María Pérez"
            />
          </div>
          <div>
            <div className="text-xs opacity-60">Email</div>
            <input
              name="email"
              type="email"
              defaultValue={email}
              className="w-full border rounded px-2 py-1"
              placeholder="correo@dominio.com"
            />
          </div>
          <div>
            <div className="text-xs opacity-60">Teléfono</div>
            <input
              name="phone"
              defaultValue={phone}
              className="w-full border rounded px-2 py-1"
              placeholder="+52 55 1234 5678"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button className="px-3 py-1.5 border rounded">Crear</button>
          <span className="text-xs opacity-60">Requerimos al menos <b>email</b> o <b>teléfono</b>.</span>
        </div>
      </form>
    </div>
  );
}
