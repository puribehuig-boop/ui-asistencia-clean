import KanbanBoard from "./KanbanBoard";
import { createSupabaseServerClient } from "@/lib/supabase/serverClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function KanbanPage() {
  const supabase = createSupabaseServerClient();

  // Guard
  const { data: auth } = await supabase.auth.getUser();
  const { data: me } = await supabase.from("profiles").select("role").eq("user_id", auth?.user?.id ?? "").maybeSingle();
  const role = (me?.role ?? "").toLowerCase();
  if (!["admin","admissions"].includes(role)) return <div className="p-6">No tienes acceso.</div>;

  const { data: rows } = await supabase
    .from("prospects")
    .select("id, full_name, email, phone, stage, owner_user_id, last_contact_at, created_at")
    .order("updated_at", { ascending: false })
    .limit(500);

  const cols: Record<string, any[]> = {
    nuevo: [], contactado: [], interesado: [],
    en_proceso: [], aceptado: [], inscrito: [], descartado: [],
  };
  for (const r of rows ?? []) {
    const k = (r.stage ?? "nuevo") as keyof typeof cols;
    if (!cols[k]) cols[k] = [];
    cols[k].push(r);
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Admisiones · Kanban</h1>
        <a href="/staff/admissions/prospects" className="text-sm underline">Ver lista</a>
      </div>
      <KanbanBoard initial={cols} />
    </div>
  );
}
