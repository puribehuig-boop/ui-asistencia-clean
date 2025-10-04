// app/staff/admissions/prospects/page.tsx
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/serverClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const STAGES = [
  { key: "",            label: "Todas" },
  { key: "nuevo",       label: "Nuevo" },
  { key: "contactado",  label: "Contactado" },
  { key: "interesado",  label: "Interesado" },
  { key: "en_proceso",  label: "En proceso" },
  { key: "aceptado",    label: "Aceptado" },
  { key: "inscrito",    label: "Inscrito" },
  { key: "descartado",  label: "Descartado" },
];

function slaColor(last_contact_at?: string | null, created_at?: string | null) {
  const base = last_contact_at ?? created_at ?? null;
  if (!base) return "#6b7280"; // gris
  const diffMs = Date.now() - new Date(base).getTime();
  const diffH = diffMs / 3_600_000;
  if (diffH <= 24) return "#16a34a"; // verde
  if (diffH <= 48) return "#ca8a04"; // ámbar
  return "#dc2626"; // rojo
}

export default async function ProspectsPage({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  const supabase = createSupabaseServerClient();

  // Guard
  const { data: auth } = await supabase.auth.getUser();
  const { data: me } = await supabase.from("profiles").select("role,user_id").eq("user_id", auth?.user?.id ?? "").maybeSingle();
  const role = (me?.role ?? "").toLowerCase();
  if (!["admin","admissions"].includes(role)) return <div className="p-6">No tienes acceso.</div>;

  // Filtros desde querystring
  const q           = (searchParams?.q as string) ?? "";
  const stage       = (searchParams?.stage as string) ?? "";
  const term_id     = (searchParams?.term_id as string) ?? "";
  const program_id  = (searchParams?.program_id as string) ?? "";
  const ownerParam  = (searchParams?.owner as string) ?? ""; // "me" | "none" | uuid | ""
  const mineOverdue = (searchParams?.mine_overdue as string) === "1";

  // Catálogos (para selects)
  const [{ data: terms }, { data: programs }, { data: staff }] = await Promise.all([
    supabase.from("Term").select("id,name").order("name", { ascending: true }),
    supabase.from("Program").select("id,name").order("name", { ascending: true }),
    supabase.from("profiles").select("user_id,email,role").in("role", ["admin","admissions"]).order("email", { ascending: true }),
  ]);

  // Query base
  let query = supabase
    .from("prospects")
    .select("id, full_name, email, phone, stage, owner_user_id, program_id, term_id, last_contact_at, created_at, updated_at")
    .order("updated_at", { ascending: false })
    .limit(1000);

  if (stage) query = query.eq("stage", stage);
  if (term_id) query = query.eq("term_id", Number(term_id));
  if (program_id) query = query.eq("program_id", Number(program_id));

  // owner: me | none | uuid
  if (ownerParam === "me") {
    query = query.eq("owner_user_id", auth?.user?.id ?? "");
  } else if (ownerParam === "none") {
    query = query.is("owner_user_id", null);
  } else if (ownerParam) {
    query = query.eq("owner_user_id", ownerParam);
  }

  // Búsqueda: nombre/correo/teléfono (ilike)
  if (q) {
    const esc = q.replaceAll("%","").replaceAll(","," ");
    query = query.or(`full_name.ilike.%${esc}%,email.ilike.%${esc}%,phone.ilike.%${esc}%`);
  }

  const { data: raw } = await query;
  let rows = raw ?? [];

  // Mis atrasados: >48h sin contacto (o sin contacto y creado hace >48h) y owner = yo
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

  // Mapas para mostrar etiquetas
  const programMap = new Map((programs ?? []).map((p: any) => [p.id, p.name ?? `Programa #${p.id}`]));
  const termMap = new Map((terms ?? []).map((t: any) => [t.id, t.name ?? `Term #${t.id}`]));
  const staffMap = new Map((staff ?? []).map((s: any) => [s.user_id, s.email]));

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Admisiones · Prospectos</h1>
        <a href="/staff/admissions/prospects/new" className="px-3 py-1.5 border rounded hover:bg-gray-50">Agregar prospecto</a>
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
            {STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </div>

        <div>
          <div className="opacity-60 text-xs">Propietario</div>
          <select name="owner" defaultValue={ownerParam} className="w-full border rounded px-2 py-1">
            <option value="">Todos</option>
            <option value="me">Yo</option>
            <option value="none">Sin asignar</option>
            {(staff ?? []).map((s: any) => (
              <option key={s.user_id} value={s.user_id}>{s.email}</option>
            ))}
          </select>
        </div>

        <div className="md:col-span-6 flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="mine_overdue" value="1" defaultChecked={mineOverdue} />
            Mis atrasados (&gt;48h sin contacto)
          </label>
          <div className="flex gap-2">
            <button className="px-3 py-1 border rounded">Aplicar</button>
            <a href="/staff/admissions/prospects" className="px-3 py-1 border rounded">Limpiar</a>
          </div>
        </div>
      </form>

      {/* Tabla */}
      <div className="border rounded">
        <div className="grid grid-cols-12 px-3 py-2 bg-gray-50 text-sm font-medium">
          <div className="col-span-1 text-black">ID</div>
          <div className="col-span-3 text-black">Prospecto</div>
          <div className="col-span-2 text-black">Programa / Periodo</div>
          <div className="col-span-2 text-black">Etapa</div>
          <div className="col-span-2 text-black">Propietario</div>
          <div className="col-span-2 text-black">SLA</div>
        </div>
        <div>
          {(rows ?? []).map((r: any) => (
            <div key={r.id} className="grid grid-cols-12 border-t px-3 py-2 text-sm">
              <div className="col-span-1">#{r.id}</div>
              <div className="col-span-3">
                <div className="font-medium">
                  <a href={`/staff/admissions/prospects/${r.id}`} className="underline">{r.full_name ?? "—"}</a>
                </div>
                <div className="opacity-70 text-xs">
                  {r.email ?? "—"}{r.phone ? ` · ${r.phone}` : ""}
                </div>
              </div>
              <div className="col-span-2">
                <div>{r.program_id ? (programMap.get(r.program_id) ?? `Programa #${r.program_id}`) : "—"}</div>
                <div className="opacity-70 text-xs">{r.term_id ? (termMap.get(r.term_id) ?? `Term #${r.term_id}`) : "—"}</div>
              </div>
              <div className="col-span-2 capitalize">{r.stage}</div>
              <div className="col-span-2">{r.owner_user_id ? (staffMap.get(r.owner_user_id) ?? r.owner_user_id) : "Sin asignar"}</div>
              <div className="col-span-2 flex items-center gap-2">
                <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: slaColor(r.last_contact_at, r.created_at) }} />
                <span className="text-xs opacity-70">{r.last_contact_at ? new Date(r.last_contact_at).toLocaleString() : new Date(r.created_at).toLocaleString()}</span>
              </div>
            </div>
          ))}
          {(!rows || !rows.length) && <div className="p-4 text-sm opacity-70">Sin resultados.</div>}
        </div>
      </div>
    </div>
  );
}
