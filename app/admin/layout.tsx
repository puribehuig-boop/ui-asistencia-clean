// app/admin/layout.tsx
import { createSupabaseServerClient } from "@/lib/supabase/serverClient";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type Profile = { user_id: string; email: string | null; role: "admin" | "docente" };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase.auth.getUser();

    // DIAGNÓSTICO: no redirigimos; mostramos qué ve el layout
    if (error || !data?.user) {
      return (
        <main className="max-w-3xl mx-auto p-6">
          <h1 className="text-xl font-semibold mb-3">Admin Layout · Diagnóstico</h1>
          <p className="mb-2">No hay sesión visible en el layout.</p>
          <pre className="text-xs p-3 bg-black/5 rounded whitespace-pre-wrap">
{JSON.stringify({ error: error?.message ?? null, user: data?.user ?? null }, null, 2)}
          </pre>
          <a className="underline underline-offset-2" href="/login">Ir a login</a>
        </main>
      );
    }

    // Leer perfil/rol desde profiles
    const rows = await prisma.$queryRaw<Profile[]>`
      SELECT user_id, email, role
      FROM public.profiles
      WHERE user_id = ${data.user.id}
      LIMIT 1
    `;
    const profile = rows[0] ?? null;

    if (!profile || profile.role !== "admin") {
      return (
        <main className="max-w-3xl mx-auto p-6">
          <h1 className="text-xl font-semibold mb-3">Admin Layout · Diagnóstico</h1>
          <p className="mb-2">El usuario no es admin o no existe perfil.</p>
          <pre className="text-xs p-3 bg-black/5 rounded whitespace-pre-wrap">
{JSON.stringify({ hasUser: !!data.user, user: data.user, profile }, null, 2)}
          </pre>
          <a className="underline underline-offset-2" href="/logout">Cerrar sesión</a>
        </main>
      );
    }

    // Si todo OK, render normal
    return (
      <div className="max-w-5xl mx-auto p-6">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold">Panel Admin</h1>
          <nav className="flex gap-4 mt-3 text-sm">
            <a href="/admin" className="underline-offset-4 hover:underline">Inicio</a>
            <a href="/admin/programs" className="underline-offset-4 hover:underline">Programas</a>
            <a href="/admin/subjects" className="underline-offset-4 hover:underline">Materias</a>
            <a href="/admin/terms" className="underline-offset-4 hover:underline">Periodos</a>
            <a href="/admin/groups" className="underline-offset-4 hover:underline">Grupos</a>
            <a href="/logout" className="underline-offset-4 hover:underline">Salir</a>
          </nav>
        </header>
        {children}
      </div>
    );
  } catch (e: any) {
    // Mostrar error real del servidor (lo que Next oculta en prod)
    return (
      <main className="max-w-3xl mx-auto p-6">
        <h1 className="text-xl font-semibold mb-3">Error en Admin (diagnóstico)</h1>
        <pre className="text-xs p-3 bg-black/5 rounded whitespace-pre-wrap">
{String(e?.message || e)}
        </pre>
        <a className="underline underline-offset-2" href="/api/auth/me">/api/auth/me</a>
      </main>
    );
  }
}
