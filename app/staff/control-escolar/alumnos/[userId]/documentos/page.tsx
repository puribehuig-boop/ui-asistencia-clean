// app/staff/control-escolar/alumnos/[userId]/documentos/page.tsx
import { createSupabaseServerClient } from "@/lib/supabase/serverClient";
import Uploader from "./uploader";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const DOC_LABELS: Record<string, string> = {
  cert_bach: "Certificado de Bachillerato",
  curp: "CURP",
  ficha_inscripcion: "Ficha de Inscripción",
  acta_nacimiento: "Acta de Nacimiento",
  copia_titulo: "Copia de Título",
};

export default async function AlumnoDocumentosPage({ params }: { params: { userId: string } }) {
  const supabase = createSupabaseServerClient();

  // Guard SSR (staff/admin)
  const { data: auth } = await supabase.auth.getUser();
  const { data: me } = await supabase.from("profiles").select("role").eq("user_id", auth?.user?.id ?? "").maybeSingle();
  const role = (me?.role ?? "").toLowerCase();
  if (!["admin","control_escolar","staff"].includes(role)) {
    return <div className="p-6">No tienes acceso.</div>;
  }

  // Encontrar StudentProfile por userId (uuid en texto) o por id numérico si params.userId viene como número
  let student: any = null;
  // primero intenta userId (uuid)
  const byUser = await supabase.from("StudentProfile").select('id, "fullName", "userId"').eq("userId", params.userId).maybeSingle();
  if (byUser.data) student = byUser.data;
  // si no, intenta por id numérico
  if (!student && /^\d+$/.test(params.userId)) {
    const byId = await supabase.from("StudentProfile").select('id, "fullName", "userId"').eq("id", Number(params.userId)).maybeSingle();
    student = byId.data;
  }
  if (!student) {
    return <div className="p-6">Alumno no encontrado.</div>;
  }

  // Leer documentos guardados
  const { data: docs } = await supabase
    .from("student_documents")
    .select("id, doc_type, storage_path, original_name, status, notes, created_at, updated_at, size_bytes, mime_type")
    .eq("student_id", student.id)
    .order("doc_type", { ascending: true });

  // Crear URLs firmadas para ver/descargar
const urlMap: Record<number, string | undefined> = {};
for (const d of docs ?? []) {
  const objPath = d.storage_path.replace(/^student-docs\//, "");
  const { data: signed } = await supabase.storage
    .from("student-docs")
    .createSignedUrl(objPath, 300);
  urlMap[d.id] = signed?.signedUrl;
}

  return (
    <div className="p-4 space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Documentos del Alumno</h1>
        <div className="text-sm opacity-70">#{student.id} · {student.fullName ?? student.userId}</div>
      </div>

      <Uploader studentId={student.id} />

      <div className="border rounded">
        <div className="grid grid-cols-12 px-3 py-2 bg-gray-50 text-sm font-medium">
          <div className="col-span-3 text-black">Documento</div>
          <div className="col-span-3 text-black">Archivo</div>
          <div className="col-span-2 text-black">Estatus</div>
          <div className="col-span-2 text-black">Actualizado</div>
          <div className="col-span-2 text-black">Acciones</div>
        </div>
        <div>
          {(docs ?? []).map((d) => (
            <div key={d.id} className="grid grid-cols-12 px-3 py-2 border-t text-sm items-center">
              <div className="col-span-3">{DOC_LABELS[d.doc_type] ?? d.doc_type}</div>
              <div className="col-span-3">{d.original_name ?? "—"}</div>
              <div className="col-span-2">
                <span className="px-2 py-0.5 rounded text-white text-xs"
                  style={{
                    background:
                      d.status === "verified" ? "#16a34a" :
                      d.status === "rejected" ? "#dc2626" : "#6b7280"
                  }}
                >
                  {d.status}
                </span>
              </div>
              <div className="col-span-2">{new Date(d.updated_at ?? d.created_at).toLocaleString()}</div>
              <div className="col-span-2 flex gap-2">
                {(() => {
                  const u = urlMap[d.id];
                  return u ? (
                    <a className="text-xs underline" href={u} target="_blank" rel="noreferrer">
                      Ver
                    </a>
                  ) : null;
                })()}
              
                {/* Acciones rápidas de estatus */}
                <form action={`/api/staff/docs/status`} method="post" className="flex gap-1">
                  <input type="hidden" name="docId" value={d.id} />
                  <button name="status" value="verified" className="text-xs border rounded px-2 py-0.5">Verificar</button>
                  <button name="status" value="rejected" className="text-xs border rounded px-2 py-0.5">Rechazar</button>
                </form>
              </div>
            </div>
          ))}
          {(!docs || !docs.length) && <div className="p-4 text-sm opacity-70">Sin documentos.</div>}
        </div>
      </div>
    </div>
  );
}
