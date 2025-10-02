// app/staff/control-escolar/alumnos/[userId]/page.tsx
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/serverClient";
import { supabaseAdmin } from "@/lib/supabase/adminClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const REQUIRED_DOCS: { value: string; label: string }[] = [
  { value: "cert_bach", label: "Certificado de Bachillerato" },
  { value: "curp", label: "CURP" },
  { value: "ficha_inscripcion", label: "Ficha de Inscripción" },
  { value: "acta_nacimiento", label: "Acta de Nacimiento" },
  { value: "copia_titulo", label: "Copia de Título" },
];

const DOC_LABELS: Record<string, string> = REQUIRED_DOCS.reduce((acc, d) => {
  acc[d.value] = d.label;
  return acc;
}, {} as Record<string, string>);

function hhmm(t?: string | null) {
  if (!t) return "—";
  const s = String(t);
  if (/^\d{4}$/.test(s)) return `${s.slice(0, 2)}:${s.slice(2, 4)}`;
  if (/^\d{2}:\d{2}/.test(s)) return s.slice(0, 5);
  return s;
}

export default async function StudentDetailPage({ params }: { params: { userId: string } }) {
  const supabase = createSupabaseServerClient();
  const userIdParam = params.userId;

  // Guard SSR (solo admin/staff/control_escolar)
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    return (
      <div className="p-6">
        <p>Necesitas iniciar sesión.</p>
        <a href="/login" className="underline">Ir a login</a>
      </div>
    );
  }
  const { data: me } = await supabase.from("profiles").select("role").eq("user_id", auth.user.id).maybeSingle();
  const role = (me?.role ?? "").toLowerCase();
  if (!["admin", "control_escolar", "staff"].includes(role)) {
    return (
      <div className="p-6">
        <p>No tienes acceso.</p>
        <a className="underline" href="/profile">Volver</a>
      </div>
    );
  }

  // Resolver alumno por userId (uuid) o por id numérico
  let student: { id: number; fullName?: string | null; userId?: string | null } | null = null;

  // Primero intenta por UUID en StudentProfile.userId
  const byUser = await supabase
    .from("StudentProfile")
    .select('id, "fullName", "userId"')
    .eq("userId", userIdParam)
    .maybeSingle();

  if (byUser?.data) {
    student = byUser.data as any;
  } else if (/^\d+$/.test(userIdParam)) {
    // Si no, intenta por id numérico
    const byId = await supabase
      .from("StudentProfile")
      .select('id, "fullName", "userId"')
      .eq("id", Number(userIdParam))
      .maybeSingle();
    student = (byId?.data as any) ?? null;
  }

  if (!student) {
    return <div className="p-6">Alumno no encontrado.</div>;
  }

  // Identidad "texto" para consultas que mezclan ids (vista v_group_roster y attendance.student_id)
  const studentIdText = student.userId ?? String(student.id);

  // Documentos cargados (metadatos)
  const { data: docs } = await supabase
    .from("student_documents")
    .select("id, doc_type, storage_path, original_name, status, updated_at, created_at, size_bytes, mime_type")
    .eq("student_id", student.id);

  const docsByType = new Map<string, any>();
  (docs ?? []).forEach((d) => docsByType.set(d.doc_type, d));

  // URLs firmadas para ver/descargar (si hay archivo) — usar server client
  const urlMap: Record<number, string | undefined> = {};
  for (const d of docs ?? []) {
    const objectPath = d.storage_path.replace(/^student-docs\//, "");
    const { data: signed } = await supabase.storage.from("student-docs").createSignedUrl(objectPath, 300);
    urlMap[d.id] = signed?.signedUrl;
  }

  // Documentos faltantes
  const missing = REQUIRED_DOCS.filter((r) => !docsByType.has(r.value));

  // Ruta para "Cargar o editar documentos"
  const slug = student.userId ?? String(student.id);
  const editHref = `/staff/control-escolar/alumnos/${slug}/documentos`;

  // Perfil y nombre (usa el userId real del estudiante si existe)
  let prof: { email?: string | null; role?: string | null } | null = null;
  let sp2: { userId?: string | null; fullName?: string | null; first_name?: string | null; last_name?: string | null } | null = null;

  if (student.userId) {
    const [{ data: profData }, { data: spData }] = await Promise.all([
      supabaseAdmin.from("profiles").select("email, role").eq("user_id", student.userId).maybeSingle(),
      supabaseAdmin.from("StudentProfile").select('userId, fullName, "first_name","last_name"').eq("userId", student.userId).maybeSingle(),
    ]);
    prof = profData ?? null;
    sp2 = spData ?? null;
  } else {
    // No hay UUID; intenta al menos obtener nombres por id numérico
    const { data: spData } = await supabaseAdmin
      .from("StudentProfile")
      .select('userId, fullName, "first_name","last_name"')
      .eq("id", student.id)
      .maybeSingle();
    sp2 = spData ?? null;
  }

  const name =
    sp2?.fullName ||
    [sp2?.first_name, sp2?.last_name].filter(Boolean).join(" ") ||
    prof?.email ||
    "—";

  // Grupos del alumno + calificaciones finales (vista v_group_roster con id mixto)
  const { data: roster } = await supabaseAdmin
    .from("v_group_roster")
    .select("group_id, student_id_text, final_grade")
    .eq("student_id_text", studentIdText);

  const groupIds = Array.from(new Set((roster ?? []).map((r: any) => r.group_id)));
  let groups: any[] = [];
  const subjectMap = new Map<number, string>();
  const termMap = new Map<number, string>();

  if (groupIds.length) {
    const { data: gRows } = await supabaseAdmin
      .from("Group")
      .select("id, code, subjectId, termId")
      .in("id", groupIds);
    groups = gRows ?? [];

    const subjIds = Array.from(new Set(groups.map((g: any) => g.subjectId).filter(Boolean)));
    const termIds = Array.from(new Set(groups.map((g: any) => g.termId).filter(Boolean)));

    if (subjIds.length) {
      const { data: subs } = await supabaseAdmin.from("Subject").select("id, name").in("id", subjIds);
      (subs ?? []).forEach((s: any) => subjectMap.set(s.id, s.name ?? ""));
    }
    if (termIds.length) {
      const { data: terms } = await supabaseAdmin.from("Term").select("id, name").in("id", termIds);
      (terms ?? []).forEach((t: any) => termMap.set(t.id, t.name ?? ""));
    }
  }

  // Sesiones de esos grupos (horario)
  let sessions: any[] = [];
  if (groupIds.length) {
    const { data: sRows } = await supabaseAdmin
      .from("sessions")
      .select("id, session_date, start_planned, room_code, status, is_manual, started_at, ended_at, group_id, subjectId")
      .in("group_id", groupIds)
      .order("session_date", { ascending: false })
      .order("id", { ascending: false })
      .limit(100);
    sessions = sRows ?? [];
  }

  // Asistencia del alumno (por session_id) — contempla uuid o id numérico
  const idsForAttendance: string[] = [String(student.id)];
  if (student.userId) idsForAttendance.push(student.userId);

  const { data: attRows } = await supabaseAdmin
    .from("attendance")
    .select("session_id, status, updated_at")
    .in("student_id", idsForAttendance);

  const attBySession = new Map<number, { status: string; updated_at: string | null }>();
  (attRows ?? []).forEach((a: any) => {
    attBySession.set(a.session_id, { status: a.status, updated_at: a.updated_at ?? null });
  });

  // Helpers pintables
  const groupsView = groups.map((g: any) => ({
    id: g.id,
    code: g.code ?? null,
    subjectName: g.subjectId ? (subjectMap.get(g.subjectId) ?? null) : null,
    termName: g.termId ? (termMap.get(g.termId) ?? null) : null,
    finalGrade: (roster ?? []).find((r: any) => r.group_id === g.id)?.final_grade ?? null,
  }));

  const sessionsView = sessions.map((s: any) => ({
    id: s.id,
    date: s.session_date ?? null,
    time: hhmm(s.start_planned ?? null),
    room: s.room_code ?? null,
    status: s.status ?? null,
    subjectName: s.subjectId ? (subjectMap.get(s.subjectId) ?? null) : null,
    myStatus: attBySession.get(s.id)?.status ?? "—",
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Alumno: {name}</h1>
        <div className="text-sm opacity-70">
          {(prof?.email ?? "—")} · Rol: {(prof?.role ?? "—")}
        </div>
      </div>

      {/* Nav local simple */}
      <div className="flex flex-wrap gap-2 border-b pb-2 text-sm">
        <a href="#info" className="px-2 py-1 rounded border">Información y documentos</a>
        <a href="#historial" className="px-2 py-1 rounded border">Historial</a>
        <a href="#boletas" className="px-2 py-1 rounded border">Boletas</a>
        <a href="#horarios" className="px-2 py-1 rounded border">Horarios</a>
        <a href="#asistencia" className="px-2 py-1 rounded border">Asistencia</a>
      </div>

      {/* Sección: Información y documentos */}
      <section id="info" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Documentación</h2>
          <Link href={editHref} className="px-3 py-1 border rounded text-sm hover:bg-gray-50">
            Cargar o editar documentos
          </Link>
        </div>

        {/* Documentos cargados */}
        <div className="border rounded">
          <div className="grid grid-cols-12 px-3 py-2 bg-gray-50 text-sm font-medium">
            <div className="col-span-4 text-black">Documento</div>
            <div className="col-span-4 text-black">Archivo</div>
            <div className="col-span-2 text-black">Estatus</div>
            <div className="col-span-2 text-black">Acciones</div>
          </div>
          <div>
            {(docs ?? []).length ? (
              (docs ?? []).map((d) => (
                <div key={d.id} className="grid grid-cols-12 px-3 py-2 border-t text-sm items-center">
                  <div className="col-span-4">{DOC_LABELS[d.doc_type] ?? d.doc_type}</div>
                  <div className="col-span-4">{d.original_name ?? "—"}</div>
                  <div className="col-span-2">
                    <span
                      className="px-2 py-0.5 rounded text-white text-xs"
                      style={{
                        background:
                          d.status === "verified" ? "#16a34a" :
                          d.status === "rejected" ? "#dc2626" : "#6b7280",
                      }}
                    >
                      {d.status}
                    </span>
                  </div>
                  <div className="col-span-2">
                    {(() => {
                      const u = urlMap[d.id];
                      return u ? (
                        <a href={u} target="_blank" rel="noreferrer" className="text-xs underline">
                          Ver
                        </a>
                      ) : <span className="text-xs opacity-60">—</span>;
                    })()}
                  </div>
                </div>
              ))
            ) : (
              <div className="p-4 text-sm opacity-70">Sin documentos cargados.</div>
            )}
          </div>
        </div>

        {/* Documentos faltantes */}
        <div className="border rounded">
          <div className="px-3 py-2 bg-gray-50 text-sm font-medium text-black">Documentos faltantes</div>
          <div>
            {missing.length ? (
              missing.map((m) => (
                <div key={m.value} className="px-3 py-2 border-t text-sm flex items-center justify-between">
                  <span>{m.label}</span>
                  <span className="px-2 py-0.5 rounded text-white text-xs" style={{ background: "#dc2626" }}>
                    Falta
                  </span>
                </div>
              ))
            ) : (
              <div className="p-4 text-sm opacity-70">No faltan documentos requeridos.</div>
            )}
          </div>
        </div>
      </section>

      {/* Historial (placeholder) */}
      <section id="historial" className="space-y-3">
        <h2 className="font-medium">Historial</h2>
        <div className="border rounded p-3 text-sm opacity-70">
          Próximamente: cambios de grupo, inscripciones/bajas, trámites concluidos.
        </div>
      </section>

      {/* Boletas (usa final_grade por grupo) */}
      <section id="boletas" className="space-y-3">
        <h2 className="font-medium">Boletas</h2>
        <div className="border rounded">
          <div className="grid grid-cols-12 bg-gray-50 px-3 py-2 text-sm font-medium">
            <div className="col-span-5 text-black">Materia / Grupo</div>
            <div className="col-span-4 text-black">Periodo</div>
            <div className="col-span-3 text-black">Calificación final</div>
          </div>
          <div>
            {groupsView.map((g) => (
              <div key={g.id} className="grid grid-cols-12 border-t px-3 py-2 text-sm">
                <div className="col-span-5">
                  <b>{g.subjectName ?? "—"}</b>
                  <span className="opacity-70"> · {g.code ?? `Grupo #${g.id}`}</span>
                </div>
                <div className="col-span-4">{g.termName ?? "—"}</div>
                <div className="col-span-3">{g.finalGrade ?? "—"}</div>
              </div>
            ))}
            {!groupsView.length && <div className="p-4 text-sm opacity-70">Sin grupos asignados.</div>}
          </div>
        </div>
      </section>

      {/* Horarios (sesiones) */}
      <section id="horarios" className="space-y-3">
        <h2 className="font-medium">Horarios</h2>
        <div className="border rounded">
          <div className="grid grid-cols-12 bg-gray-50 px-3 py-2 text-sm font-medium">
            <div className="col-span-3 text-black">Fecha</div>
            <div className="col-span-2 text-black">Hora</div>
            <div className="col-span-3 text-black">Materia</div>
            <div className="col-span-2 text-black">Salón</div>
            <div className="col-span-2 text-black">Estado</div>
          </div>
          <div>
            {sessionsView.map((s) => (
              <div key={s.id} className="grid grid-cols-12 border-t px-3 py-2 text-sm">
                <div className="col-span-3">{s.date ?? "—"}</div>
                <div className="col-span-2">{s.time ?? "—"}</div>
                <div className="col-span-3">{s.subjectName ?? "—"}</div>
                <div className="col-span-2">{s.room ?? "—"}</div>
                <div className="col-span-2">{s.status ?? "—"}</div>
              </div>
            ))}
            {!sessionsView.length && <div className="p-4 text-sm opacity-70">Sin sesiones.</div>}
          </div>
        </div>
      </section>

      {/* Asistencia por sesión */}
      <section id="asistencia" className="space-y-3">
        <h2 className="font-medium">Asistencia</h2>
        <div className="border rounded">
          <div className="grid grid-cols-12 bg-gray-50 px-3 py-2 text-sm font-medium">
            <div className="col-span-4 text-black">Fecha / Materia</div>
            <div className="col-span-4 text-black">Salón / Sesión</div>
            <div className="col-span-4 text-black">Mi estado</div>
          </div>
          <div>
            {sessionsView.map((s) => (
              <div key={s.id} className="grid grid-cols-12 border-t px-3 py-2 text-sm">
                <div className="col-span-4">{s.date ?? "—"} · {s.subjectName ?? "—"}</div>
                <div className="col-span-4">{s.room ?? "—"} · #{s.id}</div>
                <div className="col-span-4"><b>{s.myStatus}</b></div>
              </div>
            ))}
            {!sessionsView.length && <div className="p-4 text-sm opacity-70">Sin registros.</div>}
          </div>
        </div>
      </section>
    </div>
  );
}
