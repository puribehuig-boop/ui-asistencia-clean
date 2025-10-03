// app/staff/admissions/page.tsx
import { createSupabaseServerClient } from "@/lib/supabase/serverClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdmissionsHomePage() {
  const supabase = createSupabaseServerClient();

  // Guard
  const { data: auth } = await supabase.auth.getUser();
  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", auth?.user?.id ?? "")
    .maybeSingle();
  const role = (me?.role ?? "").toLowerCase();
  if (!["admin", "admissions"].includes(role)) {
    return <div className="p-6">No tienes acceso.</div>;
  }

  // KPIs simples
  const [{ count: total }] = await Promise.all([
    supabase.from("prospects").select("*", { count: "exact", head: true }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Admisiones · Resumen</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <div className="border rounded p-3">
          <div className="text-xs opacity-60">Prospectos totales</div>
          <div className="text-2xl font-semibold">{total ?? 0}</div>
        </div>
        <a href="/staff/admissions/kanban" className="border rounded p-3 hover:bg-gray-50">
          <div className="text-xs opacity-60">Ir a</div>
          <div className="text-lg font-medium">Kanban (CRM)</div>
        </a>
        <a href="/staff/admissions/prospects" className="border rounded p-3 hover:bg-gray-50">
          <div className="text-xs opacity-60">Ir a</div>
          <div className="text-lg font-medium">Lista de prospectos</div>
        </a>
      </div>
    </div>
  );
}
