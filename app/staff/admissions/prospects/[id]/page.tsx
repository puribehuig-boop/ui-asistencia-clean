// app/staff/admissions/prospects/[id]/page.tsx
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/serverClient";
import AssignOwnerForm from "./AssignOwnerForm";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const SOURCES = ["Web", "Facebook", "Referido", "WhatsApp", "Evento", "Otro"];
const CAMPAIGNS = ["Landing 2025", "Campaña Otoño", "Campaña Primavera", "Orgánico", "Sin campaña"];

function slaBadge(ts?: string | null, fallback?: string | null) {
  const base = ts ?? fallback;
  if (!base) return { label: "SLA: sin contacto", color: "#6b7280" }; // gris
  const diffMs = Date.now() - new Date(base).getTime();
  const diffH = diffMs / 3_600_000;
  if (diffH <= 24) return { label: "SLA: <24h", color: "#16a34a" }; // verde
  if (diffH <= 48) return { label: "SLA: 24–48h", color: "#ca8a04" }; // ámbar
  return { label: "SLA: >48h", color: "#dc2626" }; // rojo
}

export default async function ProspectDetailPage({ params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();

  // Guard
  const { data: auth } = await supabase.auth.getUser();
  const { data: me } = await supabase
    .from("profiles")
    .select("role,email,user_id")
    .eq("user_id", auth?.user?.id ?? "")
    .maybeSingle();
  const role = (me?.role ?? "").toLowerCase();
  if (!["admin", "admissions"].includes(role)) return <div className="p-6">No tienes acceso.</div>;

  const prospectId = Number(params.id || 0);
  if (!prospectId) return <div className="p-6">ID inválido.</div>;

  // Prospecto
  const { data: prospect } = await supabase
    .from("prospects")
    .select(
      `id, full_name, email, phone, source, campaign, stage,
       owner_user_id, term_id, created_at, updated_at, last_contact_at`
    )
    .eq("id", prospectId)
    .maybeSingle();
  if (!prospect) return <div className="p-6">Prospecto no encontrado.</div>;

  // Owner, terms y staff para asignar
  const [{ data: owner }, { data: terms }, { data: staff }] = await Promise.all([
    prospect.owner_user_id
      ? supabase.from("profiles").select("email,user_id").eq("user_id", prospect.owner_user_id).maybeSingle()
      : Promise.resolve({ data: null } as any),
    supabase.from("Term").select("id,name").order("id", { ascending: false }),
    supabase.from("profiles").select("user_id,email,role").in("role", ["admin","admissions"]).order("email", { ascending: true }),
  ]);

  // Interacciones y tareas
  const [{ data: interactions }, { data: tasks }] = await Promise.all([
    supabase
      .from("prospect_interactions")
      .select(`id, type, note, happened_at, user_id`)
      .eq("prospect_id", prospectId)
      .order("happened_at", { ascending: false })
      .limit(200),
    supabase
      .from("prospect_tasks")
      .select(`id, title, due_at, status, user_id, created_at`)
      .eq("prospect_id", prospectId)
      .order("due_at", { ascending: true })
      .limit(200),
  ]);

  const sla = slaBadge(prospect.last_contact_at, prospect.created_at);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">Prospecto · {prospect.full_name}</h1>
          <div className="text-sm opacity-70">
            #{prospect.id} · {prospect.email ?? "—"}
            {prospect.phone ? ` · ${prospect.phone}` : ""}
          </div>
        </div>
        <div className="flex gap-3">
          <Link href="/staff/admissions/prospects" className="text-sm underline">Ver lista</Link>
          <Link href="/staff/admissions/kanban" className="text-sm underline">Ver Kanban</Link>
        </div>
      </div>

      {/* Datos + SLA + Asignación */}
      <section className="border rounded p-3 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm items-start">
          <div>
            <div className="opacity-60 text-xs">Etapa</div>
            <div className="font-medium capitalize">{prospect.stage}</div>
            <div className="text-xs opacity-60">Cámbiala desde el Kanban (por ahora).</div>
          </div>

          <div>
            <div className="opacity-60 text-xs">Propietario</div>
            <div className="flex items-center gap-2">
              <span>{owner?.email ?? "Sin asignar"}</span>
            </div>
          </div>

          <div>
            <div className="opacity-60 text-xs">SLA</div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: sla.color }} />
              <span>{sla.label}</span>
            </div>
            <div className="text-xs opacity-60">
              Se calcula con base en <b>Último contacto</b> o fecha de creación si no hay contacto.
            </div>
          </div>

          <div>
            <div className="opacity-60 text-xs">Último contacto</div>
            <div>{prospect.last_contact_at ? new Date(prospect.last_contact_at).toLocaleString() : "—"}</div>
          </div>
        </div>

        <AssignOwnerForm
          prospectId={prospectId}
          currentOwner={prospect.owner_user_id}
          staff={(staff ?? []).map((s: any) => ({ user_id: s.user_id, email: s.email }))}
          meId={me?.user_id ?? ""}
        />
      </section>

      {/* Origen/Campaña/Periodo */}
      <section className="border rounded p-3 space-y-3">
        <form
          action={`/api/staff/admissions/prospects/${prospectId}/update`}
          method="post"
          className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm"
        >
          <div>
            <div className="opacity-60 text-xs">Origen</div>
            <select name="source" defaultValue={prospect.source ?? ""} className="w-full border rounded px-2 py-1">
              <option value="">—</option>
              {SOURCES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <div className="opacity-60 text-xs">Campaña</div>
            <select name="campaign" defaultValue={prospect.campaign ?? ""} className="w-full border rounded px-2 py-1">
              <option value="">—</option>
              {CAMPAIGNS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <div className="opacity-60 text-xs">Ciclo / Periodo</div>
            <select name="term_id" defaultValue={prospect.term_id ?? ""} className="w-full border rounded px-2 py-1">
              <option value="">—</option>
              {(terms ?? []).map((t: any) => (
                <option key={t.id} value={t.id}>{t.name ?? `Term #${t.id}`}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button className="px-3 py-1 border rounded">Guardar</button>
          </div>
        </form>
      </section>

      {/* Interacciones */}
      <section className="space-y-2">
        <h2 className="font-medium">Interacciones</h2>

        <form
          action={`/api/staff/admissions/prospects/${prospectId}/interactions/add`}
          method="post"
          className="border rounded p-3 text-sm space-y-2"
        >
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
            <div>
              <div className="opacity-60 text-xs">Tipo</div>
              <select name="type" className="w-full border rounded px-2 py-1" defaultValue="nota" required>
                <option value="nota">Nota</option>
                <option value="llamada">Llamada</option>
                <option value="correo">Correo</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="visita">Visita</option>
                <option value="otro">Otro</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <div className="opacity-60 text-xs">Detalle</div>
              <textarea name="note" className="w-full border rounded px-2 py-1" rows={2} placeholder="Escribe una nota..."></textarea>
            </div>
            <div>
              <div className="opacity-60 text-xs">Fecha/hora (opcional)</div>
              <input type="datetime-local" name="happened_at" className="w-full border rounded px-2 py-1" />
            </div>
          </div>
          <div className="flex justify-end">
            <button className="px-3 py-1 border rounded">Agregar interacción</button>
          </div>
          <div className="text-xs opacity-60">Actualiza <b>Último contacto</b> automáticamente.</div>
        </form>

        <div className="border rounded">
          <div className="grid grid-cols-12 px-3 py-2 bg-gray-50 text-sm font-medium">
            <div className="col-span-2 text-black">Fecha</div>
            <div className="col-span-2 text-black">Tipo</div>
            <div className="col-span-6 text-black">Nota</div>
            <div className="col-span-2 text-black">Responsable</div>
          </div>
          <div>
            {(interactions ?? []).map((it: any) => (
              <div key={it.id} className="grid grid-cols-12 border-t px-3 py-2 text-sm">
                <div className="col-span-2">{new Date(it.happened_at).toLocaleString()}</div>
                <div className="col-span-2 capitalize">{it.type}</div>
                <div className="col-span-6 whitespace-pre-wrap">{it.note ?? "—"}</div>
                <div className="col-span-2">{it.user_id ?? "—"}</div>
              </div>
            ))}
            {(!interactions || !interactions.length) && (
              <div className="p-4 text-sm opacity-70">Sin interacciones.</div>
            )}
          </div>
        </div>
      </section>

      {/* Tareas (solo lectura) */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">Tareas</h2>
          <div className="text-xs opacity-60">CRUD llega en el siguiente paso.</div>
        </div>
        <div className="border rounded">
          <div className="grid grid-cols-12 px-3 py-2 bg-gray-50 text-sm font-medium">
            <div className="col-span-6 text-black">Título</div>
            <div className="col-span-2 text-black">Vence</div>
            <div className="col-span-2 text-black">Estado</div>
            <div className="col-span-2 text-black">Responsable</div>
          </div>
          <div>
            {(tasks ?? []).map((t: any) => (
              <div key={t.id} className="grid grid-cols-12 border-t px-3 py-2 text-sm">
                <div className="col-span-6">{t.title}</div>
                <div className="col-span-2">{t.due_at ? new Date(t.due_at).toLocaleString() : "—"}</div>
                <div className="col-span-2 capitalize">{t.status}</div>
                <div className="col-span-2">{t.user_id ?? "—"}</div>
              </div>
            ))}
            {(!tasks || !tasks.length) && (
              <div className="p-4 text-sm opacity-70">Sin tareas.</div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
