// app/staff/layout.tsx
import { createSupabaseServerClient } from "@/lib/supabase/serverClient";
import { redirect } from "next/navigation";
import Link from "next/link";
import React from "react";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const STAFF_ROLES = ["admin","staff","escolar","admisiones","caja","finanzas"];

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const supabase = createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) redirect("/login");

  const { data: me } = await supabase
    .from("profiles")
    .select("email, role")
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (!me?.role || !STAFF_ROLES.includes(me.role)) {
    redirect("/profile");
  }

  return (
    <div className="min-h-screen grid grid-cols-[260px_1fr]">
      <aside className="border-r p-4">
        <div className="mb-4">
          <div className="text-sm opacity-60">Conectado como</div>
          <div className="text-sm break-all">{me?.email ?? auth.user.email}</div>
          <div className="text-xs opacity-60">Rol: {me?.role}</div>
        </div>

        <nav className="space-y-1 text-sm">
          <Link href="/staff" className="block px-2 py-1 rounded hover:bg-gray-50">Inicio</Link>

          <div className="mt-3 text-xs uppercase opacity-60 px-2">Áreas</div>
          <Link href="/staff/admissions" className="block px-2 py-1 rounded hover:bg-gray-50">Admisiones (CRM)</Link>

          <details className="px-2 py-1 rounded" open>
            <summary className="cursor-pointer select-none">Control escolar</summary>
            <div className="mt-1 ml-3 space-y-1">
              <Link href="/staff/control-escolar/alumnos" className="block px-2 py-1 rounded hover:bg-gray-50">Alumnos</Link>
              <Link href="/staff/control-escolar/profesores" className="block px-2 py-1 rounded hover:bg-gray-50">Profesores</Link>
              <Link href="/staff/control-escolar/tramites" className="block px-2 py-1 rounded hover:bg-gray-50">Trámites</Link>
            </div>
          </details>

          <Link href="/staff/caja" className="block px-2 py-1 rounded hover:bg-gray-50">Caja</Link>
        </nav>

        <div className="mt-6">
          <a href="/logout" className="text-sm px-2 py-1 rounded border inline-block">Cerrar sesión</a>
        </div>
      </aside>

      <main className="p-6">{children}</main>
    </div>
  );
}
