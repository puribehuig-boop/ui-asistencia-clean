import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/serverClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const DOC_LABELS: Record<string, string> = {
  rfc: "RFC",
  curp: "CURP",
  comprobante_dom: "Comprobante de Domicilio",
  identificacion: "Identificación",
  titulo_lic: "Título Licenciatura",
  cedula_lic: "Cédula Licenciatura",
  titulo_maes: "Título Maestría",
  cedula_maes: "Cédula Maestría",
  titulo_doc: "Título Doctorado",
  cedula_doc: "Cédula Doctorado",
};

export default async function TeacherDocsPage({ params }: { params: { userId: string } }) {
  const supabase = createSupabaseServerClient();

  // Guard SSR staff
  const { data: auth } = await supabase.auth.getUser();
  const { data: me } = await supabase.from("profiles").select("role").eq("user_id", auth?.user?.id ?? "").maybeSingle();
  const role = (me?.role ?? "").toLowerCase();
  if (!["admin","control_escolar","staff"].includes(role)) {
    return <div className="p-6">No tienes acceso.</div>;
  }

  // Perfil profesor
  const [{ data: prof }, { data: tp }] = await Promise.all([
    supabase.from("profiles").select("email, role").eq("user_id", params.userId).maybeSingle(),
    supabase.from("teacher_profile").select("user_id, first_name, last_name").eq("user_id", params.userId).maybeSingle(),
  ]);
  const name = [tp?.first_name, tp?.last_name].filter(Boolean).join(" ") || prof?.email || params.userId;

  // Metadatos de documentos
  const { data: docs } = await supabase
    .from("teacher_documents")
    .select("id, doc_type, storage_path, original_name, status, updated_at, created_at, size_bytes, mime_type")
    .eq("teacher_user_id", params.userId)
    .order("doc_type", { ascending: true });

  // URLs firmadas
  const urlMap: Record<number, string | undefined> = {};
  for (const d of docs ?? []) {
    const objectPath = d.storage_path.replace(/^teacher-docs\//, "");
    const { data: signed } = await supabase.storage.from("teacher-docs").createSignedUrl(objectPath, 300);
    urlMap[d.id] = signed?.signedUrl;
  }

  const Uploader = (await import("./uploader")).default;

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">Documentos del Profesor</h1>
          <div className="text-sm opacity-70">{name} · {prof?.email ?? "—"}</div>
        </div>
        <Link href={`/staff/control-escolar/profesores/${params.userId}`} className="text-sm underline">
          Volver a perfil
        </Link>
      </div>

      <Uploader teacherUserId={params.userId} />

      <div className="border rounded">
        <div className="grid grid-cols-12 px-3 py-2 bg-gray-50 text-sm font-medium">
          <div className="col-span-4 text-black">Documento</div>
          <div className="col-span-4 text-black">Archivo</div>
          <div className="col-span-2 text-black">Estatus</div>
          <div className="col-span-2 text-black">Acciones</div>
        </div>
        <div>
          {(docs ?? []).map((d) => (
            <div key={d.id} className="grid grid-cols-12 px-3 py-2 border-t text-sm items-center">
              <div className="col-span-4">{DOC_LABELS[d.doc_type] ?? d.doc_type}</div>
              <div className="col-span-4">{d.original_name ?? "—"}</div>
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
              <div className="col-span-2 flex gap-2">
                {(() => {
                  const u = urlMap[d.id];
                  return u ? (
                    <a href={u} target="_blank" rel="noreferrer" className="text-xs underline">Ver</a>
                  ) : <span className="text-xs opacity-60">—</span>;
                })()}
                <form action={`/api/staff/tdocs/status`} method="post" className="flex gap-1">
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
