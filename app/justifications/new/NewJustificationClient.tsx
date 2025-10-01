// app/justifications/new/NewJustificationClient.tsx
"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browserClient";

export default function NewJustificationClient() {
  const sp = useSearchParams();
  const router = useRouter();
  const sessionId = Number(sp.get("sessionId") || 0);

  const [reason, setReason] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!sessionId) {
      router.replace("/profile?tab=asistencia");
    }
  }, [sessionId, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!sessionId || !reason.trim()) {
      alert("Completa el motivo.");
      return;
    }
    setLoading(true);
    try {
      let evidencePath: string | null = null;

      if (file) {
        const supabase = createSupabaseBrowserClient();
        const { data: userRes } = await supabase.auth.getUser();
        const uid = userRes?.user?.id;
        if (!uid) throw new Error("No autenticado");

        const key = `${uid}/${sessionId}/${Date.now()}_${file.name}`;
        const up = await supabase.storage.from("justifications").upload(key, file, { upsert: true });
        if (up.error) throw up.error;

        evidencePath = key;
      }

      const res = await fetch("/api/justifications/new", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId, reason, evidencePath }),
      });
      const j = await res.json();
      if (!res.ok || !j.ok) throw new Error(j.error || "error");

      alert("Justificación enviada.");
      router.replace("/profile?tab=asistencia");
    } catch (err: any) {
      alert(`Error: ${err.message || String(err)}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto p-6 space-y-4">
      <h1 className="text-lg font-semibold">Solicitar justificación</h1>
      <form onSubmit={onSubmit} className="space-y-3">
        <div className="text-sm">Sesión: <b>#{sessionId || "—"}</b></div>

        <div>
          <label className="text-sm block mb-1">Motivo</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full border rounded p-2 text-sm"
            rows={4}
            placeholder="Describe el motivo de la justificación…"
            required
          />
        </div>

        <div>
          <label className="text-sm block mb-1">Evidencia (opcional)</label>
          <input
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.heic,.webp"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
          <div className="text-xs opacity-60 mt-1">
            Formatos comunes (PDF, JPG, PNG). Máx ~5MB recomendado.
          </div>
        </div>

        <div className="flex gap-2">
          <button disabled={loading} className="px-3 py-2 border rounded">
            {loading ? "Enviando..." : "Enviar"}
          </button>
          <a className="px-3 py-2 border rounded" href="/profile?tab=asistencia">Cancelar</a>
        </div>
      </form>
    </div>
  );
}
