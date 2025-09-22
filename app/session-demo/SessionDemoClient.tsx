'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

type EstadoSesion = 'No iniciada' | 'En curso' | 'Finalizada';
const ESTADOS_ALUMNO = ['Presente', 'Tarde', 'Ausente', 'Justificado'] as const;
type EstadoAlumno = (typeof ESTADOS_ALUMNO)[number];

type Alumno = { id: string; nombre: string; status?: EstadoAlumno; };

const alumnosBase: Alumno[] = [
  { id: 'A-01', nombre: 'Ana Torres' },
  { id: 'A-02', nombre: 'Luis Gómez' },
  { id: 'A-03', nombre: 'María Pérez' },
  { id: 'A-04', nombre: 'Carlos Ruiz' },
];

export default function SessionDemoClient() {
  const params = useSearchParams();
  const sessionId = params.get('sessionId') ?? 'demo-123';
  const roomId = params.get('roomId') ?? 'A-101';

  const [estado, setEstado] = useState<EstadoSesion>('No iniciada');
  const [alumnos, setAlumnos] = useState<Alumno[]>(alumnosBase);
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadingAtt, setLoadingAtt] = useState(true);

  const puedeIniciar = estado === 'No iniciada';
  const puedeMarcar = estado === 'En curso'; // Justificado siempre editable
  const puedeTerminar = estado === 'En curso';

  const info = useMemo(() => ({
    materia: 'Introducción a la Ingeniería',
    grupo: 'Grupo A',
    salon: roomId,
    horario: '08:00–09:30',
  }), [roomId]);

  // Cargar asistencias existentes de la BD al entrar
  useEffect(() => {
    let canceled = false;
    const load = async () => {
      setLoadingAtt(true);
      try {
        const r = await fetch(`/api/attendance/list?sessionId=${encodeURIComponent(sessionId)}`);
        const j = await r.json();
        if (canceled) return;
        if (r.ok && j.ok && Array.isArray(j.items)) {
          // Mapear statuses por student_id
          const map = new Map<string, EstadoAlumno>();
          j.items.forEach((it: any) => { if (it.student_id && it.status) map.set(String(it.student_id), it.status as EstadoAlumno); });
          setAlumnos(prev => prev.map(a => map.has(a.id) ? { ...a, status: map.get(a.id) } : a));
        }
      } catch {
        /* noop */
      } finally {
        if (!canceled) setLoadingAtt(false);
      }
    };
    load();
    return () => { canceled = true; };
  }, [sessionId]);

  const marcarLocal = (id: string, status: EstadoAlumno) => {
    setAlumnos(prev => prev.map(a => a.id === id ? { ...a, status } : a));
  };

  const guardarAsistencia = async (alumno: Alumno, status: EstadoAlumno) => {
    setMsg(null);
    try {
      const r = await fetch('/api/attendance/set', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          roomId,
          studentId: alumno.id,
          studentName: alumno.nombre,
          status
        })
      });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.error || 'No se pudo guardar asistencia');
      setMsg(`✅ ${alumno.nombre}: ${status}`);
    } catch (e: any) {
      setMsg('❌ ' + (e?.message || 'Error guardando asistencia'));
    }
  };

  const marcar = async (id: string, status: EstadoAlumno) => {
    const alumno = alumnos.find(a => a.id === id);
    if (!alumno) return;
    // Optimista
    marcarLocal(id, status);
    await guardarAsistencia(alumno, status);
  };

  const iniciarSesion = async () => {
    setSaving(true); setMsg(null);
    try {
      const r = await fetch('/api/sessions/start', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, roomId })
      });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.error || 'No se pudo iniciar sesión');
      setEstado('En curso');
      setMsg('✅ Sesión guardada (en curso).');
    } catch (e: any) {
      setMsg('❌ ' + (e?.message || 'Error iniciando sesión'));
    } finally {
      setSaving(false);
    }
  };

  const terminarSesion = async () => {
    setSaving(true); setMsg(null);
    try {
      const r = await fetch('/api/sessions/finish', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId })
      });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.error || 'No se pudo terminar sesión');
      setEstado('Finalizada');
      setMsg('✅ Sesión finalizada y guardada.');
    } catch (e: any) {
      setMsg('❌ ' + (e?.message || 'Error al terminar sesión'));
    } finally {
      setSaving(false);
    }
  };

  const resumen = useMemo(() => {
    const base = { Presente: 0, Tarde: 0, Ausente: 0, Justificado: 0 } as Record<EstadoAlumno, number>;
    for (const a of alumnos) if (a.status) base[a.status]++;
    const total = alumnos.length;
    return { ...base, total };
  }, [alumnos]);

  return (
    <main className="space-y-6">
      <section className="bg-white/5 border border-white/10 rounded-2xl p-6">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h2 className="text-lg font-semibold">Sesión: {sessionId}</h2>
            <p className="opacity-80 text-sm mt-1">
              {info.materia} · {info.grupo} · Salón {info.salon} · {info.horario}
            </p>
          </div>
          <span className="text-xs px-2 py-1 rounded-lg bg-white/10 border border-white/10">{estado}</span>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            disabled={!puedeIniciar || saving}
            onClick={iniciarSesion}
            className={"px-4 py-2 rounded-xl border " + (puedeIniciar && !saving ? "bg-white/10 hover:bg-white/20 border-white/10" : "bg-white/5 border-white/10 opacity-50 cursor-not-allowed")}
          >
            Iniciar clase
          </button>

          <button
            disabled={!puedeMarcar}
            onClick={() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })}
            className={"px-4 py-2 rounded-xl border " + (puedeMarcar ? "bg-white/10 hover:bg-white/20 border-white/10" : "bg-white/5 border-white/10 opacity-50 cursor-not-allowed")}
          >
            Tomar asistencia
          </button>

          <button
            disabled={!puedeTerminar || saving}
            onClick={terminarSesion}
            className={"px-4 py-2 rounded-xl border " + (puedeTerminar && !saving ? "bg-white/10 hover:bg-white/20 border-white/10" : "bg-white/5 border-white/10 opacity-50 cursor-not-allowed")}
          >
            Terminar clase
          </button>
        </div>

        {msg && <p className="mt-3 text-xs">{msg}</p>}

        <div className="mt-4 text-xs opacity-80 flex flex-wrap gap-x-4 gap-y-1">
          <span>Total: {resumen.total}</span>
          <span>Presente: {resumen.Presente}</span>
          <span>Tarde: {resumen.Tarde}</span>
          <span>Ausente: {resumen.Ausente}</span>
          <span>Justificado: {resumen.Justificado}</span>
          {loadingAtt && <span>Cargando asistencias…</span>}
        </div>

        <p className="mt-2 text-xs opacity-70">
          Nota: <b>Justificado</b> puede editarse en cualquier momento, incluso después de finalizar la sesión.
        </p>
      </section>

      <section className="bg-white/5 border border-white/10 rounded-2xl p-6">
        <h3 className="text-base font-medium mb-3">Lista de alumnos</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {alumnos.map(a => (
            <div key={a.id} className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl p-3">
              <div className="text-sm">
                <div className="font-medium">{a.nombre}</div>
                <div className="opacity-70 text-xs">{a.id}</div>
              </div>
              <div className="flex gap-2">
                {ESTADOS_ALUMNO.map(s => {
                  const editableSiempre = s === 'Justificado';
                  const disabled = !(estado === 'En curso' || editableSiempre);
                  return (
                    <button
                      key={s}
                      disabled={disabled}
                      onClick={() => marcar(a.id, s)}
                      className={
                        "px-3 py-1 text-xs rounded-lg border " +
                        (a.status === s ? "bg-white/20" : "bg-white/10 hover:bg-white/20") +
                        (disabled ? " opacity-50 cursor-not-allowed" : "")
                      }
                      title={editableSiempre ? 'Justificado se puede marcar en cualquier momento' : (estado !== 'En curso' ? 'Solo editable durante la sesión' : '')}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
