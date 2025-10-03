"use client";
import { useState } from "react";

type Prospect = {
  id: number;
  full_name: string;
  email: string | null;
  phone: string | null;
  stage: string;
  owner_user_id?: string | null;
  last_contact_at?: string | null;
  created_at?: string;
};

const STAGES: { key: string; label: string }[] = [
  { key: "nuevo",        label: "Nuevo" },
  { key: "contactado",   label: "Contactado" },
  { key: "interesado",   label: "Interesado" },
  { key: "en_proceso",   label: "En proceso" },
  { key: "aceptado",     label: "Aceptado" },
  { key: "inscrito",     label: "Inscrito" },
  { key: "descartado",   label: "Descartado" },
];

function slaColor(p: Prospect) {
  const base = p.last_contact_at ?? p.created_at ?? null;
  if (!base) return "#6b7280"; // gris
  const diffMs = Date.now() - new Date(base).getTime();
  const diffH = diffMs / 3_600_000;
  if (diffH <= 24) return "#16a34a";    // verde
  if (diffH <= 48) return "#ca8a04";    // ámbar
  return "#dc2626";                     // rojo
}

export default function KanbanBoard({ initial }: { initial: Record<string, Prospect[]> }) {
  const [cols, setCols] = useState<Record<string, Prospect[]>>(initial);

  function onDragStart(e: React.DragEvent, item: Prospect) {
    e.dataTransfer.setData("text/plain", JSON.stringify({ id: item.id, from: item.stage }));
  }

  async function onDrop(e: React.DragEvent, toStage: string) {
    e.preventDefault();
    const data = e.dataTransfer.getData("text/plain");
    if (!data) return;
    const parsed = JSON.parse(data) as { id: number; from: string };
    if (parsed.from === toStage) return;

    // Optimista
    setCols(prev => {
      const next = { ...prev };
      const fromArr = [...(next[parsed.from] ?? [])];
      const idx = fromArr.findIndex(p => p.id === parsed.id);
      if (idx >= 0) {
        const [card] = fromArr.splice(idx, 1);
        card.stage = toStage;
        next[parsed.from] = fromArr;
        next[toStage] = [card, ...(next[toStage] ?? [])];
      }
      return next;
    });

    // Persistir
    const resp = await fetch("/api/staff/admissions/prospects/move", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: parsed.id, stage: toStage }),
    });
    if (!resp.ok) {
      const j = await resp.json().catch(() => ({}));
      alert("Error moviendo: " + (j?.error ?? resp.statusText));
    }
  }

  async function takeLead(id: number) {
    const resp = await fetch(`/api/staff/admissions/prospects/${id}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "take" }),
    });
    if (!resp.ok) {
      const j = await resp.json().catch(() => ({}));
      alert("Error asignando: " + (j?.error ?? resp.statusText));
    } else {
      // Refresco optimista: marcamos como asignado (owner_user_id != null)
      setCols(prev => {
        const next: Record<string, Prospect[]> = {};
        for (const k of Object.keys(prev)) {
          next[k] = prev[k].map(p => p.id === id ? { ...p, owner_user_id: "me" } : p);
        }
        return next;
      });
    }
  }

  return (
    <div className="grid md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
      {STAGES.map(col => (
        <div
          key={col.key}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => onDrop(e, col.key)}
          className="border rounded p-2 min-h-[300px] bg-gray-50"
        >
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-medium">{col.label}</h3>
            <span className="text-xs opacity-70">{cols[col.key]?.length ?? 0}</span>
          </div>

          <div className="space-y-2">
            {(cols[col.key] ?? []).map(card => (
              <div
                key={card.id}
                draggable
                onDragStart={(e) => onDragStart(e, card)}
                className="bg-white border rounded p-2 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div className="font-medium text-sm">{card.full_name}</div>
                  <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: slaColor(card) }} />
                </div>
                <div className="text-xs opacity-70">
                  {card.email ?? "—"} {card.phone ? `· ${card.phone}` : ""}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <a href={`/staff/admissions/prospects/${card.id}`} className="text-xs underline">Abrir</a>
                  {!card.owner_user_id && (
                    <button
                      onClick={() => takeLead(card.id)}
                      className="text-xs border rounded px-2 py-0.5"
                    >
                      Tomar lead
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
