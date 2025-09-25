// app/admin/layout.tsx
import { createSupabaseServerClient } from "@/lib/supabase/serverClient";
import { redirect } from "next/navigation";
import Link from "next/link";
import React from "react";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) redirect("/login");

  const { data: me } = await supabase
    .from("profiles")
    .select("email, role")
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (me?.role !== "admin") {
    // Si no es admin, lo regresamos a su perfil
    redirect("/profile");
  }

  return (
    <div className="min-h-screen grid grid-cols-[240px_1fr]">
      <aside className="border-r p-4">
        <div className="mb-4">
          <div className="text-sm opacity-60">Conectado como</div>
          <div className="text-sm break-all">{me?.email ?? auth.user.email}</div>
          <div className="text-xs opacity-60">Rol: admin</div>
        </div>

        <nav className="space-y-1 text-sm">
          <Link href="/admin" className="block px-2 py-1 rounded hover:bg-gray-50">Inicio</Link>

          <div className="mt-3 text-xs uppercase opacity-60 px-2">Catálogos</div>
          <Link href="/admin/programs" className="block px-2 py-1 rounded hover:bg-gray-50">Programas</Link>
          <Link href="/admin/subjects" className="block px-2 py-1 rounded hover:bg-gray-50">Materias</Link>
          <Link href="/admin/terms" className="block px-2 py-1 rounded hover:bg-gray-50">Periodos</Link>
          <Link href="/admin/groups" className="block px-2 py-1 rounded hover:bg-gray-50">Grupos</Link>

          <div className="mt-3 text-xs uppercase opacity-60 px-2">Operación</div>
          <Link href="/admin/sessions" className="block px-2 py-1 rounded hover:bg-gray-50">Sesiones</Link>
          <Link href="/admin/users" className="block px-2 py-1 rounded hover:bg-gray-50">Usuarios</Link>
          <Link href="/admin/reports" className="block px-2 py-1 rounded hover:bg-gray-50">Reportes</Link>
        </nav>

        <div className="mt-6">
          <a href="/logout" className="text-sm px-2 py-1 rounded border inline-block">Cerrar sesión</a>
        </div>
      </aside>

      <main className="p-6">{children}</main>
    </div>
  );
}
