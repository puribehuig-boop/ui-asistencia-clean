"use client";

import { useEffect, useMemo, useState } from "react";

type Ses = { id: number; session_code: string|null; session_date: string|null; start_planned: string|null; started_at: string|null; };
type Row = { id: number; student_id: number; student_name: string; status: string; updated_at: string; };

const STATUSES = ["Presente","Tarde","Ausente","Justificado"] as const;

export default function SessionDetailClient({ session, initialAttendance }: { session: Ses; initialAttendance: Row[] }) {
  const [rows, setRows] = useState<Row[]>(initialAttendance);
  const [studentId, setStudentId] = useState<string>("");
  const [studentName, setStudentName] = useState<string>("");
  const [status, setStatus] = useState<string>("Presente");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string>("");

  async function refresh() {
    const r = await fetch(`/api/teacher/sessions/${session.id}/attendance`, { cache: "no-store" });
    const j = await r.json();
    if (j?.ok) setRows(j.items);
  }

  async function handleMark(s?: string) {
    setLoading(true);
    setMsg("");
    try {
      const body: any = {
        sessionId: session.id,               // BIGINT
        studentId: Number(studentId),
        status: (s ?? status),
      };
      if (studentName.trim()) body.studentName = studentName.trim();

      const r = await fetch("/api/attendance/set", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!r.ok || !j?.ok) {
        setMsg(`Error: ${j?.error || r.statusText}`);
      } else {
        setMsg(`Marcado: ${j.record?.status}`);
        setStudentId("");
        await refresh();
      }
    } catch (e: any) {
      setMsg(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const s of STATUSES) c[s] = 0;
    for (const r of rows) c[r.status] = (c[r.status] ?? 0) + 1;
    return c;
  }, [rows]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Sesión #{session.id}</h1>
        <p className="text-sm opacity-70">
          {session.session_date ?? "—"} • {session.start_planned ?? "—"} • {session.session_code ?? "—"}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="border rounded p-4 space-y-3">
          <h2 className="font-medium">Marcar asistencia</h2>

          <div className="space-y-2">
            <label className="block text-sm">Student ID (numérico)</label>
            <input className="w-full border rounded px-3 py-2"
                   value={studentId} onChange={e=>setStudentId(e.target.value)}
                   placeholder="Ej. 1001" />
          </div>

          <div className="space-y-2">
            <label className="block text-sm">Nombre del alumno (opcional)</label>
            <input className="w-full border rounded px-3 py-2"
                   value={studentName} onChange={e=>setStudentName(e.target.value)}
                   placeholder="Ej. Juan Pérez" />
          </div>

          <div className="space-y-2">
            <label className="block text-sm">Estado</label>
            <select className="w-full border rounded px-3 py-2"
                    value={status} onChange={e=>setStatus(e.target.value)}>
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="flex flex-wrap gap-2">
            {STATUSES.map(s => (
              <button key={s} onClick={()=>handleMark(s)} disabled={loading}
                      className="px-3 py-2 rounded border">
                {s}
              </button>
            ))}
          </div>

          <button onClick={()=>handleMark()} disabled={loading}
                  className="px-4 py-2 rounded bg-black text-white">
            {loading ? "Guardando..." : "Marcar"}
          </button>

          {msg && <div className="text-sm mt-2">{msg}</div>}
        </div>

        <div className="border rounded p-4 space-y-2">
          <h2 className="font-medium">Resumen</h2>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {STATUSES.map(s => (
              <div key={s} className="flex justify-between border rounded px-2 py-1">
                <span>{s}</span><span>{counts[s]}</span>
              </div>
            ))}
          </div>
          <div className="pt-2">
            <a className="underline text-sm" href={`/api/teacher/sessions/${session.id}/export`}>Exportar CSV</a>
          </div>
        </div>
      </div>

      <div className="border rounded">
        <div className="grid grid-cols-5 gap-2 p-3 text-sm font-medium bg-gray-50">
          <div>ID</div>
          <div>Alumno</div>
          <div>Nombre</div>
          <div>Estado</div>
          <div>Actualizado</div>
        </div>
        {rows.map(r => (
          <div key={r.id} className="grid grid-cols-5 gap-2 p-3 border-t text-sm">
            <div>{r.student_id}</div>
            <div>{r.student_id}</div>
            <div className="truncate">{r.student_name}</div>
            <div>{r.status}</div>
            <div>{new Date(r.updated_at).toLocaleString()}</div>
          </div>
        ))}
        {rows.length === 0 && <div className="p-4 text-sm">Sin registros aún.</div>}
      </div>
    </div>
  );
}
