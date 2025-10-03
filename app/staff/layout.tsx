// app/staff/layout.tsx
import { createSupabaseServerClient } from "@/lib/supabase/serverClient";
import SidebarNav from "./SidebarNav";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const supabase = createSupabaseServerClient();

  // Guard SSR: perfiles con rol staff/admin/control_escolar/admissions
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
  const allowed = ["admin", "staff", "control_escolar", "admissions"];
  if (!allowed.includes(role)) {
    return (
      <div className="p-6">
        <p>No tienes acceso.</p>
        <a className="underline" href="/profile">Volver</a>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="grid grid-cols-12 gap-4">
        <aside className="col-span-12 md:col-span-3 lg:col-span-2">
          <SidebarNav />
        </aside>
        <main className="col-span-12 md:col-span-9 lg:col-span-10">
          {children}
        </main>
      </div>
    </div>
  );
}
