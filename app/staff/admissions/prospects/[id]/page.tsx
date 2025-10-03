// app/staff/admissions/prospects/[id]/page.tsx
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/serverClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ProspectDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createSupabaseServerClient();

  // Guard SSR
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

  // Prospecto + dueño + término
  const { data: prospect } = await supabase
    .from("prospects")
    .select(
      `
      id, full_name, email, phone, source, campaign, stage,
      owner_user_id, term_id, created_at, updated_at, last_contact_at
    `
    )
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

  const [{ data: owner }, { data: term }] = await Promise.all([
    prospect.owner_user_id
      ? supabase
          .from("profiles")
          .select("email")
          .eq("user_id", prospect.owner_user_id)
          .maybeSingle()
      : Promise.resolve({ data: null } as any),
    prospect.term_id
      ? supabase
          .from("Term")
          .select("id, name")
          .eq("id", prospect.term_id)
          .maybeSingle()
      : Promise.resolve({ data: null } as any),
  ]);

  // Interacciones y tareas
  const [{ data: interactions }, { data: tasks }] = await Promise.all([
    supabase
      .from("prospect_interactions")
      .select(
        `
        id, type, note, happened_at,
        user_id
      `
      )
      .eq("prospect_id", prospectId)
      .order("happened_at", { ascending: false })
      .limit(200),
    supabase
      .from("prospect_tasks")
      .select(
        `
        id, title, due_at, status, user_id, created_at
      `
      )
      .eq("prospect_id", prospectId)
      .order("due_at", { ascending: true })
      .limit(200),
  ]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">
            Prospecto · {prospect.full_name}
          </h1>
          <div className="text-sm opacity-70">
            #{prospect.id} · {prospect.email ?? "—"}
            {prospect.phone ? ` · ${prospect.phone}` : ""}
          </div>
        </div>
        <div className="flex gap-3">
          <Link href="/staff/admissions/prospects" className="text-sm underline">
            Ver lista
          </Link>
          <Link href="/staff/admissions/kanban" className="text-sm underline">
            Ver Kanban
          </Link>
        </div>
      </div>

      {/* Datos básicos */}
      <section className="border rounded p-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div>
            <div className="opacity-60 text-xs">Etapa</div>
            <div className="font-medium capitalize">{prospect.stage}</div>
          </div>
          <div>
            <div className="opacity-60 text-xs">Propietario</div>
            <div>{owner?.email ?? "Sin asignar"}</div>
          </div>
          <div>
            <div className="opacity-60 text-xs">Origen / Campaña</div>
            <div>
              {prospect.source ?? "—"}{" "}
              {prospect.campaign ? `· ${prospect.campaign}` : ""}
            </div>
          </div>
          <div>
            <div className="opacity-60 text-xs">Ciclo / Periodo</div>
            <div>{term?.name ?? "—"}</div>
          </div>
          <div>
            <div className="opacity-60 text-xs">Creado</div>
            <div>{new Date(prospect.created_at).toLocaleString()}</div>
          </div>
          <div>
            <div className="opacity-60 text-xs">Último contacto</div>
            <div>
              {prospect.last_contact_at
                ? new Date(prospect.last_contact_at).toLocaleString()
                : "—"}
            </div>
          </div>
        </div>
      </section>

      {/* Interacciones */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">Interacciones</h2>
          {/* Espacio para botón "Añadir interacción" (próxima fase) */}
        </div>
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
                <div className="col-span-2">
                  {new Date(it.happened_at).toLocaleString()}
                </div>
                <div className="col-span-2 capitalize">{it.type}</div>
                <div className="col-span-6 whitespace-pre-wrap">
                  {it.note ?? "—"}
                </div>
                <div className="col-span-2">{it.user_id ?? "—"}</div>
              </div>
            ))}
            {(!interactions || !interactions.length) && (
              <div className="p-4 text-sm opacity-70">Sin interacciones.</div>
            )}
          </div>
        </div>
      </section>

      {/* Tareas */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">Tareas</h2>
          {/* Espacio para botón "Nueva tarea" (próxima fase) */}
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
                <div className="col-span-2">
                  {t.due_at ? new Date(t.due_at).toLocaleString() : "—"}
                </div>
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
