// app/staff/admissions/kanban/page.tsx
import KanbanBoard from "./KanbanBoard";
import { createSupabaseServerClient } from "@/lib/supabase/serverClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function KanbanPage({ searchParams }: { searchParams?: Record<string,string | string[] | undefined> }) {
  const supabase = createSupabaseServerClient();

  // Guard
  const { data: auth } = await supabase.auth.getUser();
  const { data: me } = await supabase.from("profiles").select("role,user_id").eq("user_id", auth?.user?.id ?? "").maybeSingle();
  const role = (me?.role ?? "").toLowerCase();
  if (!["admin","admissions"].includes(role)) return <div className="p-6">No tienes acceso.</div>;

  const q           = (searchParams?.q as string) ?? "";
  const stage       = (searchParams?.stage as string) ?? "";
  const term_id     = (searchParams?.term_id as string) ?? "";
  const program_id  = (searchParams?.program_id as string) ?? "";
  const ownerParam  = (searchParams?.owner as string) ?? ""; // me | none | uuid | ""
  const mineOverdue = (searchParams?.mine_overdue as string) === "1";

  const [{ data: terms }, { data: programs }, { data: staff }] = await Promise.all([
    supabase.from("Term").select("id,name").order("name", { ascending: true }),
    supabase.from("Program").select("id,name").order("name", { ascending: true }),
    supabase.from("profiles").select("user_id,email,role").in("role", ["admin","admissions"]).order("email", { ascending: true }),
  ]);

  let query = supabase
    .from("prospects")
    .select("id, full_name, email, phone, stage, owner_user_id, last_contact_at, created_at, term_id, program_id")
    .order("updated_at", { ascending: false })
    .limit(1000);

  if (stage) query = query.eq("stage", stage);
  if (term_id) query = query.eq("term_id", Number(term_id));
  if (program_id) query = query.eq("program_id", Number(program_id));

  if (ownerParam === "me") {
    query = query.eq("owner_user_id", auth?.user?.id ?? "");
  } else if (ownerParam === "none") {
    query = query.is("owner_user_id", null);
  } else if (ownerParam) {
    query = query.eq("owner_user_id", ownerParam);
  }

  if (q) {
    const esc = q.replaceAll("%","").replaceAll(","," ");
    query = query.or(`full_name.ilike.%${esc}%,email.ilike.%${esc}%,phone.ilike.%${esc}%`);
  }

  const { data } = await query;
  let rows = data ?? [];

  if (mineOverdue) {
    const cutoff = Date.now() - 48 * 3600 * 1000;
    const myId = auth?.user?.id ?? "";
    rows = rows.filter(r => {
      if (r.owner_user_id !== myId) return false;
      const base = r.last_contact_at ? new Date(r.last_contact_at).getTime()
                                     : (r.created_at ? new Date(r.created_at).getTime() : Infinity);
      return base < cutoff;
    });
  }

  // Split por etapa
  const cols: Record<string, any[]> = {
    nuevo: [], contactado: [], interesado: [], en_proceso: [], aceptado: [], inscrito: [], descartado: [],
  };
  for (const r of rows) {
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

      {/* Filtros */}
      <form method="get" className="border rounded p-3 grid grid-cols-1 md:grid-cols-6 gap-3 text-sm">
        <div className="md:col-span-2">
          <div className="opacity-60 text-xs">Nombre / correo / teléfono</div>
          <input name="q" defaultValue={q} className="w-full border rounded px-2 py-1" placeholder="Buscar..." />
        </div>

        <div>
          <div className="opacity-60 text-xs">Programa</div>
          <select name="program_id" defaultValue={program_id} className="w-full border rounded px-2 py-1">
            <option value="">Todos</option>
            {(programs ?? []).map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        <div>
          <div className="opacity-60 text-xs">Periodo</div>
          <select name="term_id" defaultValue={term_id} className="w-full border rounded px-2 py-1">
            <option value="">Todos</option>
            {(terms ?? []).map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>

        <div>
          <div className="opacity-60 text-xs">Etapa</div>
          <select name="stage" defaultValue={stage} className="w-full border rounded px-2 py-1">
            <option value="">Todas</option>
            <option value="nuevo">Nuevo</option>
            <option value="contactado">Contactado</option>
            <option value="interesado">Interesado</option>
            <option value="en_proceso">En proceso</option>
            <option value="aceptado">Aceptado</option>
            <option value="inscrito">Inscrito</option>
            <option value="descartado">Descartado</option>
          </select>
        </div>

        <div>
          <div className="opacity-60 text-xs">Propietario</div>
          <select name="owner" defaultValue={ownerParam} className="w-full border rounded px-2 py-1">
            <option value="">Todos</option>
            <option value="me">Yo</option>
            <option value="none">Sin asignar</option>
            {/* Opcional: lista de staff si quieres elegir a alguien más */}
          </select>
        </div>

        <div className="md:col-span-6 flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="mine_overdue" value="1" defaultChecked={mineOverdue} />
            Mis atrasados (&gt;48h sin contacto)
          </label>
          <div className="flex gap-2">
            <button className="px-3 py-1 border rounded">Aplicar</button>
            <a href="/staff/admissions/kanban" className="px-3 py-1 border rounded">Limpiar</a>
          </div>
        </div>
      </form>

      <KanbanBoard initial={cols} />
    </div>
  );
}
