// app/staff/control-escolar/profesores/page.tsx
import { supabaseAdmin } from "@/lib/supabase/adminClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Term = { id: number; name: string | null };
type Subject = { id: number; name: string | null };
type Group = { id: number; code: string | null; subjectId: number | null; termId: number | null; teacher_user_id: string | null };
type TeacherProfile = { user_id: string; first_name: string | null; last_name: string | null; status?: string | null };

function toInt(v?: string | null) {
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export default async function ProfesSearchPage({
  searchParams,
}: {
  searchParams?: { q?: string; termId?: string; subjectId?: string; groupId?: string; status?: string };
}) {
  const q = (searchParams?.q ?? "").trim();
  const termId = toInt(searchParams?.termId ?? null);
  const subjectId = toInt(searchParams?.subjectId ?? null);
  const groupId = toInt(searchParams?.groupId ?? null);
  const status = (searchParams?.status ?? "").trim(); // ej. 'active'

  // Catálogos
  const [{ data: terms }, { data: subjects }] = await Promise.all([
    supabaseAdmin.from("Term").select("id, name").order("name", { ascending: true }),
    supabaseAdmin.from("Subject").select("id, name").order("name", { ascending: true }),
  ]);

  // Grupos por filtros (para acotar profesores por asignación)
  let grp = supabaseAdmin.from("Group").select("id, code, subjectId, termId, teacher_user_id").not("teacher_user_id", "is", null);
  if (termId != null) grp = grp.eq("termId", termId);
  if (subjectId != null) grp = grp.eq("subjectId", subjectId);
  const { data: groups } = await grp.order("code", { ascending: true });

  const effectiveGroupIds = groupId != null ? [groupId] : Array.from(new Set((groups ?? []).map((g: any) => g.id)));
  const teacherIdsByGroups = new Set<string>();
  (groups ?? []).forEach((g: any) => {
    if (groupId != null && g.id !== groupId) return;
    if (g.teacher_user_id) teacherIdsByGroups.add(g.teacher_user_id);
  });

  // Base de perfiles (rol docente)
  let profsQuery = supabaseAdmin.from("profiles").select("user_id, email, role").eq("role", "docente").order("email", { ascending: true });
  if (teacherIdsByGroups.size) {
    profsQuery = profsQuery.in("user_id", Array.from(teacherIdsByGroups));
  }
  if (q) {
    profsQuery = profsQuery.ilike("email", `%${q}%`);
  }
  const { data: profs } = await profsQuery;

  // Nombres y status desde teacher_profile
  const ids = (profs ?? []).map((p) => p.user_id);
  let tpById = new Map<string, TeacherProfile>();
  if (ids.length) {
    let tpq = supabaseAdmin.from("teacher_profile").select("user_id, first_name, last_name, status").in("user_id", ids);
    if (status) tpq = tpq.eq("status", status);
    const { data: tps } = await tpq;
    (tps ?? []).forEach((r: any) => tpById.set(r.user_id, r));
  }

  // Filtrar por status si no hubo intersección
  let rows = (profs ?? [])
    .filter((p) => !status || (tpById.get(p.user_id)?.status ?? "") === status)
    .map((p) => {
      const tp = tpById.get(p.user_id);
      const name = [tp?.first_name, tp?.last_name].filter(Boolean).join(" ");
      return { user_id: p.user_id as string, email: p.email as string, name, status: tp?.status ?? null };
    });

  // Filtro adicional por nombre si q no pegó al email
  if (q) {
    const qLower = q.toLowerCase();
    rows = rows.filter((r) => r.email.toLowerCase().includes(qLower) || (r.name || "").toLowerCase().includes(qLower));
  }

  // Opciones para selects
  const termOpts = (terms as Term[] | null) ?? [];
  const subjOpts = (subjects as Subject[] | null) ?? [];
  const groupOpts = (groups as Group[] | null) ?? [];

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Profesores</h1>

      {/* Filtros */}
      <form className="grid grid-cols-1 md:grid-cols-5 gap-2">
        <input name="q" defaultValue={q} placeholder="Buscar por correo o nombre…" className="px-2 py-1 border rounded" />

        <select name="termId" defaultValue={termId ?? ""} className="px-2 py-1 border rounded">
          <option value="">Periodo</option>
          {termOpts.map((t) => (
            <option key={t.id} value={t.id}>{t.name ?? `Term #${t.id}`}</option>
          ))}
        </select>

        <select name="subjectId" defaultValue={subjectId ?? ""} className="px-2 py-1 border rounded">
          <option value="">Materia</option>
          {subjOpts.map((s) => (
            <option key={s.id} value={s.id}>{s.name ?? `Subj #${s.id}`}</option>
          ))}
        </select>

        <select name="groupId" defaultValue={groupId ?? ""} className="px-2 py-1 border rounded">
          <option value="">Grupo</option>
          {groupOpts.map((g) => (
            <option key={g.id} value={g.id}>{g.code ?? `Grupo #${g.id}`}</option>
          ))}
        </select>

        <select name="status" defaultValue={status} className="px-2 py-1 border rounded">
          <option value="">Estatus</option>
          <option value="active">Activo</option>
          <option value="inactive">Inactivo</option>
        </select>

        <div className="md:col-span-5 flex items-center gap-2">
          <button className="px-3 py-1 border rounded" type="submit">Aplicar</button>
          <a
            className="px-3 py-1 border rounded"
            href={`/staff/control-escolar/profesores/export?` +
              new URLSearchParams({
                q,
                termId: termId ? String(termId) : "",
                subjectId: subjectId ? String(subjectId) : "",
                groupId: groupId ? String(groupId) : "",
                status,
              }).toString()
            }
          >
            Exportar CSV
          </a>
        </div>
      </form>

      {/* Tabla */}
      <div className="border rounded">
        <div className="grid grid-cols-12 bg-gray-50 px-3 py-2 text-sm font-medium">
          <div className="col-span-5 text-black">Profesor</div>
          <div className="col-span-5 text-black">Correo</div>
          <div className="col-span-2 text-black">Acciones</div>
        </div>
        <div>
          {rows.map((r) => (
            <div key={r.user_id} className="grid grid-cols-12 border-t px-3 py-2 text-sm items-center">
              <div className="col-span-5">{r.name || "—"}</div>
              <div className="col-span-5 break-words">{r.email}</div>
              <div className="col-span-2">
                <a className="px-2 py-1 border rounded text-xs" href={`/staff/control-escolar/profesores/${r.user_id}`}>Ver</a>
              </div>
            </div>
          ))}
          {!rows.length && <div className="p-4 text-sm opacity-70">Sin resultados.</div>}
        </div>
      </div>
    </div>
  );
}
