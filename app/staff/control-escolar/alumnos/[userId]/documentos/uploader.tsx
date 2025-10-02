"use client";
import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browserClient";

const DOCS = [
  { value: "cert_bach", label: "Certificado de Bachillerato" },
  { value: "curp", label: "CURP" },
  { value: "ficha_inscripcion", label: "Ficha de Inscripción" },
  { value: "acta_nacimiento", label: "Acta de Nacimiento" },
  { value: "copia_titulo", label: "Copia de Título" },
];

export default function Uploader({ studentId }: { studentId: number }) {
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
      const path = `${studentId}/${docType}/${ts}_${file.name}`;
      // Sube a storage (bucket privado)
      const { error: upErr } = await supabase.storage
        .from("student-docs")
        .upload(path, file, {
          cacheControl: "3600",
          upsert: true, // reemplaza si existe
          contentType: file.type || "application/octet-stream",
        });
      if (upErr) throw upErr;

      // Inserta/actualiza metadatos
      const storage_path = `student-docs/${path}`;
      const { error: insErr } = await supabase
        .from("student_documents")
        .upsert([{
          student_id: studentId,
          doc_type: docType,
          storage_path,
          original_name: file.name,
          mime_type: file.type || null,
          size_bytes: file.size || null,
          status: "pending",
        }], { onConflict: "student_id,doc_type" });
      if (insErr) throw insErr;

      // Refresca
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
        <select
          className="border rounded px-2 py-1"
          value={docType}
          onChange={(e) => setDocType(e.target.value)}
        >
          {DOCS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
        </select>
        <input
          type="file"
          className="text-sm"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <button
          type="submit"
          disabled={busy}
          className="px-3 py-1 border rounded text-sm"
        >
          {busy ? "Subiendo..." : "Guardar"}
        </button>
      </div>
      {err && <div className="text-sm text-red-600">{err}</div>}
      <div className="text-xs opacity-70">Tipos recomendados: PDF, JPG/PNG (máx. ~20MB).</div>
    </form>
  );
}
