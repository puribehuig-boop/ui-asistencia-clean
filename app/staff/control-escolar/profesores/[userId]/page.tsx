// app/staff/control-escolar/profesores/[userId]/page.tsx
import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/adminClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function hhmm(t?: string | null) {
  if (!t) return "—";
  const s = String(t);
  if (/^\d{4}$/.test(s)) return `${s.slice(0, 2)}:${s.slice(2, 4)}`;
  if (/^\d{2}:\d{2}/.test(s)) return s.slice(0, 5);
  return s;
}

const REQUIRED_DOCS: { value: string; label: string }[] = [
  { value: "rfc", label: "RFC" },
  { value: "curp", label: "CURP" },
  { value: "comprobante_dom", label: "Comprobante de Domicilio" },
  { value: "identificacion", label: "Identificación" },
  { value: "titulo_lic", label: "Título Licenciatura" },
  { value: "cedula_lic", label: "Cédula Licenciatura" },
  { value: "titulo_maes", label: "Título Maestría" },
  { value: "cedula_maes", label: "Cédula Maestría" },
  { value: "titulo_doc", label: "Título Doctorado" },
  { value: "cedula_doc", label: "Cédula Doctorado" },
];

const DOC_LABELS: Record<string, string> = REQUIRED_DOCS.reduce((acc, d) => {
  acc[d.value] = d.label;
  return acc;
}, {} as Record<string, string>);

export default async function TeacherDetailPage({ params }: { params: { userId: string } }) {
  const userId = params.userId;

  // Perfil + teacher_profile
  const [{ data: prof }, { data: tp }] = await Promise.all([
    supabaseAdmin.from("profiles").select("email, role").eq("user_id", userId).maybeSingle(),
    supabaseAdmin.from("teacher_profile").select("user_id, first_name, last_name").eq("user_id", userId).maybeSingle(),
  ]);

  const name = [tp?.first_name, tp?.last_name].filter(Boolean).join(" ") || prof?.email || "—";

  // Sesiones impartidas por el profesor
  const { data: sessions } = await supabaseAdmin
    .from("sessions")
    .select("id, session_date, start_planned, room_code, status, group_id, subjectId, started_at, ended_at")
    .eq("teacher_user_id", userId)
    .order("session_date", { ascending: false })
    .order("id", { ascending: false })
    .limit(100);

  // Mapa de materias
  const subjectIds = Array.from(new Set((sessions ?? []).map((s: any) => s.subjectId).filter(Boolean)));
  const subjectMap = new Map<number, string>();
  if (subjectIds.length) {
    const { data: subs } = await supabaseAdmin.from("Subject").select("id, name").in("id", subjectIds);
    (subs ?? []).forEach((s: any) => subjectMap.set(s.id, s.name ?? ""));
  }

  const sessionsView = (sessions ?? []).map((s: any) => ({
    id: s.id as number,
    date: s.session_date ?? null,
    time: hhmm(s.start_planned ?? null),
    room: s.room_code ?? null,
    status: s.status ?? null,
    subjectName: s.subjectId ? (subjectMap.get(s.subjectId) ?? null) : null,
  }));

  // Documentos del profesor
  const { data: docs } = await supabaseAdmin
    .from("teacher_documents")
    .select("id, doc_type, storage_path, original_name, status, updated_at, created_at")
    .eq("teacher_user_id", userId);

  const docsByType = new Map<string, any>();
  (docs ?? []).forEach((d) => docsByType.set(d.doc_type, d));

  // URLs firmadas (para "Ver")
  const urlMap: Record<number, string | undefined> = {};
  for (const d of docs ?? []) {
    const objectPath = d.storage_path.replace(/^teacher-docs\//, "");
    const { data: signed } = await supabaseAdmin.storage.from("teacher-docs").createSignedUrl(objectPath, 300);
    urlMap[d.id] = signed?.signedUrl;
  }

  const missing = REQUIRED_DOCS.filter((r) => !docsByType.has(r.value));
  const editHref = `/staff/control-escolar/profesores/${userId}/documentos`;

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div>
        <h1 className="text-lg font-semibold">Profesor: {name}</h1>
        <div className="text-sm opacity-70">{prof?.email ?? "—"} · Rol: {prof?.role ?? "—"}</div>
      </div>

      {/* Nav local */}
      <div className="flex flex-wrap gap-2 border-b pb-2 text-sm">
        <a href="#asistencia" className="px-2 py-1 rounded border">Asistencia</a>
        <a href="#info" className="px-2 py-1 rounded border">Información y documentos</a>
        <a href="#horarios" className="px-2 py-1 rounded border">Horarios</a>
      </div>

      {/* 1) Asistencia (resumen por sesión) */}
      <section id="asistencia" className="space-y-3">
        <h2 className="font-medium">Asistencia (resumen por sesión)</h2>
        <div className="border rounded">
          <div className="grid grid-cols-12 bg-gray-50 px-3 py-2 text-sm font-medium">
            <div className="col-span-3 text-black">Fecha</div>
            <div className="col-span-3 text-black">Materia</div>
            <div className="col-span-3 text-black">Salón</div>
            <div className="col-span-3 text-black">Estado</div>
          </div>
          <div>
            {sessionsView.map((s) => (
              <div key={s.id} className="grid grid-cols-12 border-t px-3 py-2 text-sm">
                <div className="col-span-3">{s.date ?? "—"} · {s.time ?? "—"}</div>
                <div className="col-span-3">{s.subjectName ?? "—"}</div>
                <div className="col-span-3">{s.room ?? "—"}</div>
                <div className="col-span-3">{s.status ?? "—"}</div>
              </div>
            ))}
            {!sessionsView.length && <div className="p-4 text-sm opacity-70">Sin sesiones.</div>}
          </div>
        </div>
      </section>

      {/* 2) Información y documentos */}
      <section id="info" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">Información y documentos</h2>
          <Link href={editHref} className="px-3 py-1 border rounded text-sm hover:bg-gray-50">
            Cargar o editar documentos
          </Link>
        </div>

        {/* Cargados */}
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
                        <a href={u} target="_blank" rel="noreferrer" className="text-xs underline">Ver</a>
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

        {/* Faltantes */}
        <div className="border rounded">
          <div className="px-3 py-2 bg-gray-50 text-sm font-medium text-black">Documentos faltantes</div>
          <div>
            {REQUIRED_DOCS.filter((r) => !docsByType.has(r.value)).length ? (
              REQUIRED_DOCS.filter((r) => !docsByType.has(r.value)).map((m) => (
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

      {/* 3) Horarios */}
      <section id="horarios" className="space-y-3">
        <h2 className="font-medium">Horarios</h2>
        <div className="border rounded">
          <div className="grid grid-cols-12 bg-gray-50 px-3 py-2 text-sm font-medium">
            <div className="col-span-3 text-black">Fecha</div>
            <div className="col-span-3 text-black">Materia</div>
            <div className="col-span-3 text-black">Hora</div>
            <div className="col-span-3 text-black">Estado</div>
          </div>
        <div>
            {sessionsView.map((s) => (
              <div key={s.id} className="grid grid-cols-12 border-t px-3 py-2 text-sm">
                <div className="col-span-3">{s.date ?? "—"}</div>
                <div className="col-span-3">{s.subjectName ?? "—"}</div>
                <div className="col-span-3">{s.time ?? "—"}</div>
                <div className="col-span-3">{s.status ?? "—"}</div>
              </div>
            ))}
            {!sessionsView.length && <div className="p-4 text-sm opacity-70">Sin sesiones.</div>}
          </div>
        </div>
      </section>
    </div>
  );
}
