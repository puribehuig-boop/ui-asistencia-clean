import { createSupabaseServerClient } from "@/lib/supabase/serverClient";
import { redirect } from "next/navigation";
import GradesRoster from "./GradesRoster";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function GroupPage({ params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) redirect("/login");

  const gid = Number(params.id);
  if (!Number.isFinite(gid)) return <div className="p-6 text-red-600">ID de grupo inválido.</div>;

  // Datos del grupo + sujeto + periodo
  const { data: g, error: gErr } = await supabase
    .from("Group")
    .select("id, code, subjectId, termId, teacher_user_id")
    .eq("id", gid)
    .maybeSingle();
  if (gErr) return <div className="p-6 text-red-600">Error: {gErr.message}</div>;
  if (!g) return <div className="p-6">Grupo no encontrado.</div>;

  // (Opcional) asegurar que el usuario es docente del grupo (o admin) — la RLS igual protege en DB
  if (g.teacher_user_id && g.teacher_user_id !== auth.user.id) {
    // Puedes redirigir o solo mostrar partial
  }

  const { data: subj } = await supabase.from("Subject").select("name").eq("id", g.subjectId).maybeSingle();
  const { data: term } = await supabase.from("Term").select("name").eq("id", g.termId).maybeSingle();

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Grupo {g.code ?? `#${g.id}`}</h1>
        <p className="text-sm opacity-70">
          Materia: <b>{subj?.name ?? "—"}</b> · Periodo: <b>{term?.name ?? "—"}</b>
        </p>
      </header>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Calificaciones finales</h2>
        <GradesRoster groupId={g.id} />
      </section>
    </div>
  );
}
