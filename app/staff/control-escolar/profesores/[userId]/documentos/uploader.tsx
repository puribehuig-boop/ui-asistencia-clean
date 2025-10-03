"use client";
import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browserClient";

const DOCS = [
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

export default function Uploader({ teacherUserId }: { teacherUserId: string }) {
  const supabase = createSupabaseBrowserClient();
  const [docType, setDocType] = useState(DOCS[0].value);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!file) { setErr("Selecciona un archivo"); return; }
    setBusy(true);
    try {
      const ts = Math.floor(Date.now() / 1000);
      const path = `${teacherUserId}/${docType}/${ts}_${file.name}`;

      // 1) Subir a storage
      const { error: upErr } = await supabase.storage
        .from("teacher-docs")
        .upload(path, file, {
          cacheControl: "3600",
          upsert: true,
          contentType: file.type || "application/octet-stream",
        });
      if (upErr) throw upErr;

      // 2) Metadatos
      const storage_path = `teacher-docs/${path}`;
      const { error: insErr } = await supabase
        .from("teacher_documents")
        .upsert([{
          teacher_user_id: teacherUserId,
          doc_type: docType,
          storage_path,
          original_name: file.name,
          mime_type: file.type || null,
          size_bytes: file.size || null,
          status: "pending",
        }], { onConflict: "teacher_user_id,doc_type" });
      if (insErr) throw insErr;

      window.location.reload();
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleUpload} className="border rounded p-3 space-y-2">
      <div className="font-medium">Subir/Reemplazar documento</div>
      <div className="flex gap-2 items-center">
        <select className="border rounded px-2 py-1" value={docType} onChange={(e) => setDocType(e.target.value)}>
          {DOCS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
        </select>
        <input type="file" className="text-sm" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <button type="submit" disabled={busy} className="px-3 py-1 border rounded text-sm">
          {busy ? "Subiendo..." : "Guardar"}
        </button>
      </div>
      {err && <div className="text-sm text-red-600">{err}</div>}
      <div className="text-xs opacity-70">PDF, JPG/PNG, máx. ~20MB.</div>
    </form>
  );
}
