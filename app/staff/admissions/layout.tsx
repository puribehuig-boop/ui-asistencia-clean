// app/staff/admissions/layout.tsx
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/serverClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function NavItem({
  href,
  label,
  currentPath,
}: {
  href: string;
  label: string;
  currentPath: string;
}) {
  const active = currentPath === href;
  return (
    <Link
      href={href}
      className={`block px-3 py-2 rounded text-sm ${
        active ? "bg-black text-white" : "hover:bg-gray-100"
      }`}
    >
      {label}
    </Link>
  );
}

export default async function AdmissionsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createSupabaseServerClient();

  // Guard SSR (admin/admissions)
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    return (
      <div className="p-6">
        <p>Necesitas iniciar sesión.</p>
        <a href="/login" className="underline">Ir a login</a>
      </div>
    );
  }
  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", auth.user.id)
    .maybeSingle();
  const role = (me?.role ?? "").toLowerCase();
  if (!["admin", "admissions"].includes(role)) {
    return (
      <div className="p-6">
        <p>No tienes acceso.</p>
        <a className="underline" href="/staff">Volver</a>
      </div>
    );
  }

  // Para resaltar item activo
  // @ts-ignore — Next inyecta headers vía request; fallback a string vacía
  const currentPath = (typeof location !== "undefined" ? location.pathname : "") as string;

  return (
    <div className="p-4">
      <div className="grid grid-cols-12 gap-4">
        <aside className="col-span-12 md:col-span-3 lg:col-span-2">
          <div className="border rounded p-3 space-y-2">
            <div className="text-xs uppercase opacity-60 mb-1">Admisiones</div>
            <NavItem href="/staff/admissions" label="Resumen" currentPath={currentPath} />
            <NavItem href="/staff/admissions/kanban" label="Kanban (CRM)" currentPath={currentPath} />
            <NavItem href="/staff/admissions/prospects" label="Prospectos" currentPath={currentPath} />
          </div>
        </aside>
        <main className="col-span-12 md:col-span-9 lg:col-span-10">{children}</main>
      </div>
    </div>
  );
}
