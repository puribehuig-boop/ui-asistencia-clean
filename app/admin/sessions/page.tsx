'use client';

import { useEffect, useMemo, useState } from 'react';
import { createSupabaseBrowserClient } from "@/lib/supabase/browserClient";
const supabase = createSupabaseBrowserClient();

type Sesion = {
  id: number; session_code: string; session_date: string; room_code: string;
  subject: string | null; group_name: string | null; start_planned: string | null; end_planned: string | null;
  started_at: string | null; ended_at: string | null;
  status: 'not_started' | 'in_progress' | 'finished' | 'blocked';
  arrival_status: 'on_time' | 'late' | 'too_late' | null; arrival_delay_min: number | null;
};

export default function AdminSessionsPage() {
  const [adminPass, setAdminPass] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [me, setMe] = useState<{email?: string; role?: string} | null>(null);

  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<Sesion[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  // Filtros
  const today = useMemo(() => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City', year:'numeric', month:'2-digit', day:'2-digit' }).format(new Date()), []);
  const [date, setDate] = useState(today);
  const [room, setRoom] = useState(''); const [group, setGroup] = useState(''); const [status, setStatus] = useState('');

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      const t = data.session?.access_token || null;
      setToken(t);
      if (t) {
        const r = await fetch('/api/auth/me', { headers: { authorization: `Bearer ${t}` } });
        const j = await r.json();
        if (j?.loggedIn) setMe({ email: j.email, role: j.role });
      }
    })();
  }, []);

  const headers = () => {
    const h: Record<string,string> = {};
    if (token) h['authorization'] = `Bearer ${token}`;
    else if (adminPass) h['x-admin-password'] = adminPass;
    return h;
  };

  const fetchSessions = async () => {
    setLoading(true); setMsg(null);
    try {
      const qs = new URLSearchParams({ date });
      if (room) qs.set('room', room);
      if (group) qs.set('group', group);
      if (status) qs.set('status', status);
      const r = await fetch(`/api/admin/sessions/list?${qs.toString()}`, { headers: headers() });
      const j = await r.json();
      if (!r.ok || !j.ok) { setAuthed(false); setMsg('❌ No autorizado o error al listar.'); setItems([]); }
      else { setAuthed(true); setItems(j.items || []); setMsg(`✅ ${j.items?.length || 0} sesiones.`); }
    } catch (e: any) { setMsg('❌ ' + (e?.message || 'Error consultando sesiones')); }
    finally { setLoading(false); }
  };

  const exportCsv = async () => {
    try {
      const qs = new URLSearchParams({ date });
      if (room) qs.set('room', room);
      if (group) qs.set('group', group);
      if (status) qs.set('status', status);
      const r = await fetch(`/api/admin/sessions/export?${qs.toString()}`, { headers: headers() });
      if (!r.ok) return setMsg('❌ No se pudo exportar CSV.');
      const blob = await r.blob();
      const url = URL.createObjectURL(blob); const a = document.createElement('a');
      a.href = url; a.download = `asistencias_${date}.csv`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
      setMsg('✅ CSV exportado.');
    } catch (e: any) { setMsg('❌ ' + (e?.message || 'Error exportando CSV')); }
  };

  const [open, setOpen] = useState<string | null>(null);
  const toggle = (code: string) => setOpen(prev => prev === code ? null : code);

  return (
    <main className="space-y-6">
      <section className="bg-white/5 border border-white/10 rounded-2xl p-6">
        <h2 className="text-lg font-semibold mb-3">Sesiones del día (Admin)</h2>
        <div className="flex flex-wrap items-end gap-3">
          {!token && (
            <>
              <div className="min-w-[220px]">
                <label className="block text-sm mb-1 opacity-80">Contraseña admin (plan B)</label>
                <input type="password" value={adminPass} onChange={(e) => setAdminPass(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/10" />
              </div>
              <a href="/auth/login" className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10">Iniciar sesión</a>
            </>
          )}
          {token && <div className="text-xs opacity-80">Sesión: {me?.email} ({me?.role})</div>}

          <div>
            <label className="block text-sm mb-1 opacity-80">Fecha</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="px-3 py-2 rounded-lg bg-white/10 border border-white/10" />
          </div>
          <div>
            <label className="block text-sm mb-1 opacity-80">Salón</label>
            <input value={room} onChange={(e) => setRoom(e.target.value)} placeholder="A-101" className="px-3 py-2 rounded-lg bg-white/10 border border-white/10" />
          </div>
          <div>
            <label className="block text-sm mb-1 opacity-80">Grupo</label>
            <input value={group} onChange={(e) => setGroup(e.target.value)} placeholder="Grupo A" className="px-3 py-2 rounded-lg bg-white/10 border border-white/10" />
          </div>
          <div>
            <label className="block text-sm mb-1 opacity-80">Estado</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="px-3 py-2 rounded-lg bg-white/10 border border-white/10">
              <option value="">(todos)</option>
              <option value="not_started">No iniciada</option>
              <option value="in_progress">En curso</option>
              <option value="finished">Finalizada</option>
              <option value="blocked">Bloqueada</option>
            </select>
          </div>

          <button onClick={fetchSessions} disabled={loading || (!token && !adminPass)} className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10">Consultar</button>
          <button onClick={exportCsv} disabled={!authed || loading} className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10">Exportar CSV</button>
        </div>
        {msg && <p className={`text-xs mt-3 ${authed ? 'text-green-300' : 'text-red-300'}`}>{msg}</p>}
      </section>

      <section className={`bg-white/5 border border-white/10 rounded-2xl p-6 ${authed ? '' : 'opacity-50 pointer-events-none'}`}>
        <TablaSesiones items={items} open={open} toggle={toggle} />
      </section>
    </main>
  );
}

function TablaSesiones({ items, open, toggle }: { items: Sesion[], open: string | null, toggle: (c: string) => void }) {
  return (
    <>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="text-left opacity-80">
            <tr>
              <th className="py-2 pr-4">Hora (plan)</th>
              <th className="py-2 pr-4">Salón</th>
              <th className="py-2 pr-4">Materia</th>
              <th className="py-2 pr-4">Grupo</th>
              <th className="py-2 pr-4">Estado</th>
              <th className="py-2 pr-4">Llegada</th>
              <th className="py-2 pr-4"></th>
            </tr>
          </thead>
          <tbody>
            {items.map(s => {
              const hora = s.start_planned ? `${s.start_planned}–${s.end_planned ?? ''}` : '—';
              const lleg = s.arrival_status ? (s.arrival_status === 'on_time' ? 'A tiempo' : s.arrival_status === 'late' ? `Tarde (+${s.arrival_delay_min}m)` : 'Sin registro') : '—';
              const est = s.status === 'in_progress' ? 'En curso' : s.status === 'finished' ? 'Finalizada' : s.status === 'blocked' ? 'Bloqueada' : 'No iniciada';
              const openRow = open === s.session_code;
              return (
                <tr key={s.id} className="border-t border-white/10">
                  <td className="py-2 pr-4">{hora}</td>
                  <td className="py-2 pr-4">{s.room_code}</td>
                  <td className="py-2 pr-4">{s.subject || '—'}</td>
                  <td className="py-2 pr-4">{s.group_name || '—'}</td>
                  <td className="py-2 pr-4">{est}</td>
                  <td className="py-2 pr-4">{lleg}</td>
                  <td className="py-2 pr-4">
                    <button onClick={() => toggle(s.session_code)} className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 border border-white/10">
                      {openRow ? 'Ocultar' : 'Ver asistencia'}
                    </button>
                  </td>
                </tr>
              );
            })}
            {items.length === 0 && <tr><td className="py-3 opacity-70" colSpan={7}>Sin resultados.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="mt-4 space-y-3">
        {items.filter(s => open === s.session_code).map(s => <AsistenciaPanel key={s.session_code} sessionCode={s.session_code} />)}
      </div>
    </>
  );
}

function AsistenciaPanel({ sessionCode }: { sessionCode: string }) {
  const [rows, setRows] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const r = await fetch(`/api/attendance/list?sessionId=${encodeURIComponent(sessionCode)}`);
        const j = await r.json();
        if (!cancelled) setRows(r.ok && j.ok ? j.items || [] : []);
      } catch { if (!cancelled) setRows([]); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [sessionCode]);

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4">
      <div className="text-sm font-medium mb-2">Asistencia — {sessionCode}</div>
      {loading && <div className="text-xs opacity-70">Cargando…</div>}
      {!loading && (rows?.length ?? 0) === 0 && <div className="text-xs opacity-70">Sin registros aún.</div>}
      {!loading && rows && rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead className="text-left opacity-80">
              <tr><th className="py-2 pr-4">Matrícula</th><th className="py-2 pr-4">Alumno</th><th className="py-2 pr-4">Estado</th><th className="py-2 pr-4">Actualizado</th><th className="py-2 pr-4">Por</th></tr>
            </thead>
            <tbody>
              {rows.map((a, i) => (
                <tr key={i} className="border-t border-white/10">
                  <td className="py-2 pr-4">{a.student_id}</td>
                  <td className="py-2 pr-4">{a.student_name}</td>
                  <td className="py-2 pr-4">{a.status}</td>
                  <td className="py-2 pr-4">{a.updated_at ? new Date(a.updated_at).toLocaleString() : '—'}</td>
                  <td className="py-2 pr-4">{a.updated_by || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}