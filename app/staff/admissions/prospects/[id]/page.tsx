// app/staff/admissions/prospects/[id]/page.tsx
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/serverClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const SOURCES = ["Web", "Facebook", "Referido", "WhatsApp", "Evento", "Otro"];
const CAMPAIGNS = ["Landing 2025", "Campaña Otoño", "Campaña Primavera", "Orgánico", "Sin campaña"];

export default async function ProspectDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createSupabaseServerClient();

  // Guard SSR (admin/admissions)
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

  const prospectId = Number(params.id || 0);
  if (!prospectId) {
    return <div className="p-6">ID inválido.</div>;
  }

  // Prospecto
  const { data: prospect } = await supabase
    .from("prospects")
    .select(`
      id, full_name, email, phone, source, campaign, stage,
      owner_user_id, term_id, created_at, updated_at, last_contact_at
    `)
    .eq("id", prospectId)
    .maybeSingle();

  if (!prospect) {
    return (
      <div className="p-6">
        Prospecto no encontrado.{" "}
        <Link href="/staff/admissions/prospects" className="underline">
          Volver a la lista
        </Link>
      </div>
    );
  }

  // Datos auxiliares
  const [{ data: owner }, { data: term }, { data: terms }] = await Promise.all([
    prospect.owner_user_id
      ? supabase
          .from("profiles")
          .select("email")
          .eq("user_id", prospect.owner_user_id)
          .maybeSingle()
      : Promise.resolve({ data: null } as any),
    prospect.term_id
      ? supabase.from("Term").select("id, name").eq("id", prospect.term_id).maybeSingle()
      : Promise.resolve({ data: null } as any),
    supabase.from("Term").select("id, name").order("id", { ascending: false }),
  ]);

  // Interacciones y tareas (solo lectura aquí; alta via form abajo)
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">Prospecto · {prospect.full_name}</h1>
          <div className="text-sm opacity-70">
            #{prospect.id} · {prospect.email ?? "—"}{prospect.phone ? ` · ${prospect.phone}` : ""}
          </div>
        </div>
        <div className="flex gap-3">
          <Link href="/staff/admissions/prospects" className="text-sm underline">Ver lista</Link>
          <Link href="/staff/admissions/kanban" className="text-sm underline">Ver Kanban</Link>
        </div>
      </div>

      {/* Datos y edición rápida */}
      <section className="border rounded p-3 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div>
            <div className="opacity-60 text-xs">Etapa</div>
            <div className="font-medium capitalize">{prospect.stage}</div>
            <div className="text-xs opacity-60">Para cambiar etapa usa el Kanban.</div>
          </div>
          <div>
            <div className="opacity-60 text-xs">Propietario</div>
            <div>{owner?.email ?? "Sin asignar"}</div>
          </div>
          <div>
            <div className="opacity-60 text-xs">Último contacto</div>
            <div>{prospect.last_contact_at ? new Date(prospect.last_contact_at).toLocaleString() : "—"}</div>
            <div className="text-xs opacity-60">Se actualiza automáticamente al registrar una interacción.</div>
          </div>
          <div>
            <div className="opacity-60 text-xs">Creado</div>
            <div>{new Date(prospect.created_at).toLocaleString()}</div>
          </div>
        </div>

        {/* Form: Origen/Campaña/Periodo */}
        <form
          action={`/api/staff/admissions/prospects/${prospectId}/update`}
          method="post"
          className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm"
        >
          <div>
            <div className="opacity-60 text-xs">Origen</div>
            <select name="source" defaultValue={prospect.source ?? ""} className="w-full border rounded px-2 py-1">
              <option value="">—</option>
              {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <div className="opacity-60 text-xs">Campaña</div>
            <select name="campaign" defaultValue={prospect.campaign ?? ""} className="w-full border rounded px-2 py-1">
              <option value="">—</option>
              {CAMPAIGNS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <div className="opacity-60 text-xs">Ciclo / Periodo</div>
            <select name="term_id" defaultValue={prospect.term_id ?? ""} className="w-full border rounded px-2 py-1">
              <option value="">—</option>
              {(terms ?? []).map(t => (
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
        <div className="flex items-center justify-between">
          <h2 className="font-medium">Interacciones</h2>
        </div>

        {/* Form: nueva interacción (actualiza last_contact_at vía trigger) */}
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
          <div className="text-xs opacity-60">
            Al guardar, se actualizará <b>Último contacto</b> automáticamente.
          </div>
        </form>

        {/* Lista */}
        <div className="border rounded">
          <div className="grid grid-cols-12 px-3 py-2 bg-gray-50 text-sm font-medium">
            <div className="col-span-2 text-black">Fecha</div>
            <div className="col-span-2 text-black">Tipo</div>
            <div className="col-span-6 text-black">Nota</div>
            <div className="col-span-2 text-black">Responsable</div>
          </div>
          <div>
            {(interactions ?? []).map((it) => (
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

      {/* Tareas (solo lectura por ahora) */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">Tareas</h2>
          <div className="text-xs opacity-60">Creación/edición viene en la siguiente fase.</div>
        </div>
        <div className="border rounded">
          <div className="grid grid-cols-12 px-3 py-2 bg-gray-50 text-sm font-medium">
            <div className="col-span-6 text-black">Título</div>
            <div className="col-span-2 text-black">Vence</div>
            <div className="col-span-2 text-black">Estado</div>
            <div className="col-span-2 text-black">Responsable</div>
          </div>
          <div>
            {(tasks ?? []).map((t) => (
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
