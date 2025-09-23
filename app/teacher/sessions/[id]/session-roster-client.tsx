"use client";
import { useEffect, useMemo, useState } from "react";

type Ses = { id: number; session_code: string|null; session_date: string|null; start_planned: string|null; started_at: string|null; };
type Settings = { attendance_tolerance_min: number; late_threshold_min: number } | null;
type Item = { student_id: number; student_name: string; status: string; updated_at: string|null };

const STATUSES = ["Presente","Tarde","Ausente","Justificado"] as const;

function hhmmToTime(hhmm?: string|null) {
  if (!hhmm) return "";
  const m = hhmm.match(/^(\d{2})(\d{2})$/);
  if (!m) return hhmm;
  return `${m[1]}:${m[2]}`;
}
function parseStartTs(ses: Ses): Date {
  const sd = ses.session_date;
  let sp = ses.start_planned;
  const startedAt = ses.started_at;
  if (sp && /^\d{4}$/.test(sp)) sp = `${sp.slice(0,2)}:${sp.slice(2)}`
  if (sd && sp) return new Date(`${sd}T${sp}:00`);
  if (startedAt) return new Date(startedAt);
  return new Date();
}

export default function SessionRosterClient({ session, settings }: { session: Ses; settings: Settings }) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string>("");

  async function load() {
    setLoading(true);
    setMsg("");
    try {
      const r = await fetch(`/api/teacher/sessions/${session.id}/roster`, { cache: "no-store" });
      const j = await r.json();
      if (!j?.ok) setMsg(j?.error || "Error cargando roster");
      else setItems(j.items);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [session.id]);

  // Ventana (el backend también valida)
  const windowInfo = useMemo(() => {
    const tol = Number(settings?.attendance_tolerance_min ?? 15);
    const start = parseStartTs(session);
    const from = new Date(start.getTime() - tol * 60_000);
    const to   = new Date(start.getTime() + tol * 60_000);
    return { from, to, now: new Date() };
  }, [session, settings]);
  const outsideWindow = windowInfo.now < windowInfo.from || windowInfo.now > windowInfo.to;

  async function setStatus(student_id: number, status: string, student_name: string) {
    setMsg("");
    const prev = items.slice();
    setItems(items.map(it => it.student_id === student_id ? { ...it, status } : it));
    try {
      const r = await fetch("/api/attendance/set", {
        method: "POST",
        headers: { "Content-Type":"application/json" },
        body: JSON.stringify({
          sessionId: session.id,
          studentId: student_id,
          studentName: student_name || `ID:${student_id}`,
          status
        })
      });
      const j = await r.json();
      if (!r.ok || !j?.ok) {
        setMsg(j?.error || r.statusText);
        setItems(prev); // revertir si falla
      } else {
        await load();   // refrescar datos reales
      }
    } catch (e:any) {
      setMsg(String(e?.message || e));
      setItems(prev);
    }
  }

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const s of STATUSES) c[s] = 0;
    for (const it of items) if (it.status) c[it.status] = (c[it.status] ?? 0) + 1;
    return c;
  }, [items]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Sesión #{session.id}</h1>
        <p className="text-sm opacity-70">
          {session.session_date ?? "—"} • {session.start_planned ? hhmmToTime(session.start_planned) : "—"} • {session.session_code ?? "—"}
        </p>
        <p className="text-xs opacity-60">
          Ventana: {windowInfo.from.toLocaleTimeString()} – {windowInfo.to.toLocaleTimeString()}
          {outsideWindow && " • (fuera de ventana: solo Justificado permitido)"}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="border rounded p-4 space-y-2">
          <h2 className="font-medium">Resumen</h2>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {STATUSES.map(s => (
              <div key={s} className="flex justify-between border rounded px-2 py-1">
                <span>{s}</span><span>{counts[s]}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="border rounded p-4 text-sm">
          {msg && <div className="text-red-600">{msg}</div>}
          <a className="underline" href={`/api/teacher/sessions/${session.id}/export`}>Exportar CSV</a>
        </div>
      </div>

      {/* Cambiamos a 7 columnas para dar más espacio a "Acciones" (col-span-2) */}
      <div className="border rounded overflow-hidden">
        <div className="grid grid-cols-7 gap-2 p-3 text-sm font-semibold bg-gray-100 text-black">
          <div>ID</div>
          <div className="col-span-2">Alumno</div>
          <div>Estado</div>
          <div>Actualizado</div>
          <div className="col-span-2">Acciones</div>
        </div>

        {items.map(it => {
          const disableNonJust = outsideWindow; // UX: fuera de ventana, solo Justificado
          return (
            <div key={it.student_id} className="grid grid-cols-7 gap-2 p-3 border-t text-sm items-center">
              <div>{it.student_id}</div>
              <div className="col-span-2 truncate">{it.student_name || <span className="opacity-60">—</span>}</div>
              <div>{it.status || <span className="opacity-60">—</span>}</div>
              <div>{it.updated_at ? new Date(it.updated_at).toLocaleString() : "—"}</div>
              <div className="col-span-2 flex flex-wrap gap-2">
                {STATUSES.map(s => (
                  <button
                    key={s}
                    className={`px-2 py-1 rounded border ${it.status===s ? "bg-black text-white" : ""}`}
                    disabled={disableNonJust && s !== "Justificado"}
                    onClick={() => setStatus(it.student_id, s, it.student_name)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          );
        })}

        {items.length === 0 && <div className="p-4 text-sm">Sin alumnos ligados a esta sesión.</div>}
      </div>
    </div>
  );
}
