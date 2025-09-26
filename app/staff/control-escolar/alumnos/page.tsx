// app/staff/control-escolar/alumnos/page.tsx
import { supabaseAdmin } from "@/lib/supabase/adminClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Term = { id: number; name: string | null };
type Program = { id: number; name: string | null };
type Subject = { id: number; name: string | null };
type Group = { id: number; code: string | null; subjectId: number | null; termId: number | null };

function toInt(v?: string | null) {
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export default async function AlumnosSearchPage({
  searchParams,
}: {
  searchParams?: { q?: string; termId?: string; programId?: string; subjectId?: string; groupId?: string };
}) {
  const q = (searchParams?.q ?? "").trim();
  const termId = toInt(searchParams?.termId ?? null);
  const programId = toInt(searchParams?.programId ?? null);
  const subjectId = toInt(searchParams?.subjectId ?? null);
  const groupId = toInt(searchParams?.groupId ?? null);

  // ===== Catálogos para filtros =====
  const [{ data: terms }, { data: programs }, { data: subjectsAll }] = await Promise.all([
    supabaseAdmin.from("Term").select("id, name").order("name", { ascending: true }),
    supabaseAdmin.from("Program").select("id, name").order("name", { ascending: true }),
    supabaseAdmin.from("Subject").select("id, name").order("name", { ascending: true }),
  ]);

  // Subjects filtradas por programa (si aplica)
  let subjectIdsByProgram: number[] | null = null;
  if (programId != null) {
    const { data: ps } = await supabaseAdmin
      .from("ProgramSubject")
      .select("subjectId")
      .eq("programId", programId);
    subjectIdsByProgram = (ps ?? []).map((r: any) => r.subjectId).filter((v: any) => v != null);
  }

  // Grupos según (termId, subjectId/programId)
  let groupFilter: Group[] = [];
  {
    let grp = supabaseAdmin.from("Group").select("id, code, subjectId, termId");
    if (termId != null) grp = grp.eq("termId", termId);
    if (subjectId != null) {
      grp = grp.eq("subjectId", subjectId);
    } else if (programId != null && subjectIdsByProgram && subjectIdsByProgram.length) {
      grp = grp.in("subjectId", subjectIdsByProgram);
    }
    const { data: gRows } = await grp.order("code", { ascending: true });
    groupFilter = (gRows as Group[] | null) ?? [];
  }

  // Si el usuario seleccionó un grupo específico, nos quedamos con él
  const effectiveGroupIds: number[] =
    groupId != null ? [groupId] : Array.from(new Set(groupFilter.map((g) => g.id)));

  // ==== Resolver universo de alumnos por filtros ====
  // Si hay filtros de grupo/periodo/materia/programa: tomamos alumnos desde v_group_roster (normaliza IDs)
  // Si NO hay filtros: tomamos todos los perfiles con role alumno/student y luego aplicamos q (email/nombre).
  let candidateStudentIds: string[] = [];

  if (effectiveGroupIds.length) {
    const { data: roster } = await supabaseAdmin
      .from("v_group_roster")
      .select("student_id_text, student_name, group_id")
      .in("group_id", effectiveGroupIds)
      .limit(5000);
    candidateStudentIds = Array.from(new Set((roster ?? []).map((r: any) => r.student_id_text)));
  }

  // Perfiles base (rol alumno|student)
  let profilesQuery = supabaseAdmin
    .from("profiles")
    .select("user_id, email, role")
    .in("role", ["alumno", "student"])
    .order("email", { ascending: true });

  if (candidateStudentIds.length) {
    profilesQuery = profilesQuery.in("user_id", candidateStudentIds);
  }
  if (q) {
    // Filtro por email (texto). Para nombre, filtramos después de traer nombres (client-side SSR aquí).
    profilesQuery = profilesQuery.ilike("email", `%${q}%`);
  }

  const { data: profs } = await profilesQuery;

  // Unir StudentProfile para nombre
  const ids = (profs ?? []).map((p) => p.user_id);
  let nameByUser: Record<string, string> = {};
  if (ids.length) {
    const { data: sps } = await supabaseAdmin
      .from("StudentProfile")
      .select('userId, fullName, "first_name","last_name"')
      .in("userId", ids);

    (sps ?? []).forEach((sp: any) => {
      const name = sp.fullName || [sp.first_name, sp.last_name].filter(Boolean).join(" ");
      nameByUser[sp.userId] = (name || "").trim();
    });
  }

  // Filtro adicional por nombre si el query q no pegó al email
  let rows = (profs ?? []).map((p: any) => ({
    user_id: p.user_id as string,
    email: p.email as string,
    name: nameByUser[p.user_id] ?? "",
    role: p.role as string,
  }));

  if (q) {
    const qLower = q.toLowerCase();
    rows = rows.filter(
      (r) => r.email.toLowerCase().includes(qLower) || (r.name || "").toLowerCase().includes(qLower)
    );
  }

  // Datos para selects
  const termOpts = (terms as Term[] | null) ?? [];
  const progOpts = (programs as Program[] | null) ?? [];
  const subjOpts =
    programId != null && subjectIdsByProgram
      ? ((subjectsAll as Subject[] | null) ?? []).filter((s) => subjectIdsByProgram!.includes(s.id))
      : ((subjectsAll as Subject[] | null) ?? []);
  const groupOpts = groupFilter;

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Alumnos</h1>

      {/* Filtros */}
      <form className="grid grid-cols-1 md:grid-cols-5 gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Buscar por correo o nombre…"
          className="px-2 py-1 border rounded"
        />

        <select name="termId" defaultValue={termId ?? ""} className="px-2 py-1 border rounded">
          <option value="">Periodo</option>
          {termOpts.map((t) => (
            <option key={t.id} value={t.id}>{t.name ?? `Term #${t.id}`}</option>
          ))}
        </select>

        <select name="programId" defaultValue={programId ?? ""} className="px-2 py-1 border rounded">
          <option value="">Programa</option>
          {progOpts.map((p) => (
            <option key={p.id} value={p.id}>{p.name ?? `Prog #${p.id}`}</option>
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

        <div className="md:col-span-5 flex items-center gap-2">
          <button className="px-3 py-1 border rounded" type="submit">Aplicar</button>
          {/* Export CSV conserva filtros actuales */}
          <a
            className="px-3 py-1 border rounded"
            href={`/staff/control-escolar/alumnos/export?` +
              new URLSearchParams({
                q,
                termId: termId ? String(termId) : "",
                programId: programId ? String(programId) : "",
                subjectId: subjectId ? String(subjectId) : "",
                groupId: groupId ? String(groupId) : "",
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
          <div className="col-span-5 text-black">Alumno</div>
          <div className="col-span-5 text-black">Correo</div>
          <div className="col-span-2 text-black">Acciones</div>
        </div>
        <div>
          {rows.map((r) => (
            <div key={r.user_id} className="grid grid-cols-12 border-t px-3 py-2 text-sm items-center">
              <div className="col-span-5">{r.name || "—"}</div>
              <div className="col-span-5 break-words">{r.email}</div>
              <div className="col-span-2">
                <a className="px-2 py-1 border rounded text-xs" href={`/staff/control-escolar/alumnos/${r.user_id}`}>Ver</a>
              </div>
            </div>
          ))}
          {!rows.length && <div className="p-4 text-sm opacity-70">Sin resultados.</div>}
        </div>
      </div>
    </div>
  );
}
