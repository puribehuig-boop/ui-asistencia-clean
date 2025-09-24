// app/teacher/sessions/[id]/SessionControls.tsx
"use client";
import { useEffect, useMemo, useState } from "react";

type Props = {
  sessionId: number;
  isManual: boolean;
  sessionDate: string | null;      // "YYYY-MM-DD"
  startPlanned: string | null;      // "HHMM" o "HH:MM" o null
  groupStartTime?: string | null;   // "HH:MM:SS" si lo tienes (opcional)
  startedAt?: string | null;        // ISO
  endedAt?: string | null;          // ISO
};

function toPlannedDate(sessionDate?: string | null, hhmm?: string | null, slotTime?: string | null) {
  if (!sessionDate) return null;
  let hh = "", mm = "";
  if (hhmm) {
    if (/^\d{4}$/.test(hhmm)) { hh = hhmm.slice(0,2); mm = hhmm.slice(2); }
    else if (/^\d{2}:\d{2}/.test(hhmm)) { hh = hhmm.slice(0,2); mm = hhmm.slice(3,5); }
  } else if (slotTime) {
    hh = slotTime.slice(0,2); mm = slotTime.slice(3,5);
  } else {
    return null;
  }
  const d = new Date(`${sessionDate}T${hh}:${mm}:00`);
  return isNaN(d.getTime()) ? null : d;
}

export default function SessionControls({
  sessionId, isManual, sessionDate, startPlanned, groupStartTime, startedAt, endedAt
}: Props) {
  const [pending, setPending] = useState(false);
  const plannedDate = useMemo(
    () => toPlannedDate(sessionDate, startPlanned, groupStartTime || null),
    [sessionDate, startPlanned, groupStartTime]
  );

  // Ventana ±30 min (solo planned); manual => siempre activo
  const withinWindow = useMemo(() => {
    if (isManual) return true;
    if (!plannedDate) return false;
    const now = new Date();
    const from = new Date(plannedDate.getTime() - 30 * 60 * 1000);
    const to   = new Date(plannedDate.getTime() + 30 * 60 * 1000);
    return now >= from && now <= to;
  }, [isManual, plannedDate]);

  const canStart = !startedAt && withinWindow;             // si no ha empezado
  const canFinish = !!startedAt && !endedAt && withinWindow; // si ya empezó y no ha terminado
  const started = !!startedAt;
  const finished = !!endedAt;

  async function call(path: string) {
    setPending(true);
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(`Error: ${j.error || res.statusText}`);
      } else {
        // refresca la página para ver los nuevos timestamps
        location.reload();
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        className="px-3 py-2 rounded border disabled:opacity-50"
        onClick={() => call("/api/sessions/start")}
        disabled={!canStart || pending}
        title={isManual ? "" : "Activo solo en la ventana ±30 min"}
      >
        Iniciar clase
      </button>
      <button
        className="px-3 py-2 rounded border disabled:opacity-50"
        onClick={() => call("/api/sessions/finish")}
        disabled={!canFinish || pending}
        title={isManual ? "" : "Activo solo en la ventana ±30 min"}
      >
        Finalizar clase
      </button>

      <div className="text-sm opacity-70">
        {started ? <>Inicio real: <b>{new Date(startedAt!).toLocaleString()}</b></> : "Sin inicio real"}
        {" · "}
        {finished ? <>Fin real: <b>{new Date(endedAt!).toLocaleString()}</b></> : "Sin fin real"}
      </div>
    </div>
  );
}
