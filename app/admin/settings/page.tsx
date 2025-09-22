'use client';

import { useEffect, useState } from 'react';
import { createSupabaseBrowserClient } from "@/lib/supabase/browserClient";
const supabase = createSupabaseBrowserClient();

export default function AdminSettingsPage() {
  const [adminPass, setAdminPass] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [me, setMe] = useState<{email?: string; role?: string} | null>(null);

  const [authed, setAuthed] = useState(false);
  const [tol, setTol] = useState<number | ''>('');
  const [late, setLate] = useState<number | ''>('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [csvText, setCsvText] = useState<string>('');
  const [replaceAll, setReplaceAll] = useState(false);

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

  const fetchTol = async () => {
    setLoading(true); setMsg(null);
    try {
      const r = await fetch('/api/admin/settings', { headers: headers() });
      if (!r.ok) { setAuthed(false); setMsg('❌ No autorizado.'); setTol(''); setLate(''); }
      else {
        const j = await r.json();
        setAuthed(true);
        setTol(j.attendance_tolerance_min ?? '');
        setLate(j.late_threshold_min ?? '');
        setMsg('✅ Acceso concedido.');
      }
    } catch { setAuthed(false); setMsg('❌ Error de conexión.'); }
    finally { setLoading(false); }
  };

  const saveTol = async () => {
    if (!authed) { setMsg('❌ Primero autentícate.'); return; }
    const t = Number(tol), l = Number(late);
    if (!Number.isFinite(t) || t < 0 || t > 240) return setMsg('❌ Tolerancia 0–240.');
    if (!Number.isFinite(l) || l < t || l > 240) return setMsg('❌ Tardanza debe ser ≥ tolerancia y ≤ 240.');
    setLoading(true); setMsg(null);
    try {
      const r = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers() },
        body: JSON.stringify({ attendance_tolerance_min: t, late_threshold_min: l }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.error || 'Error al guardar');
      setMsg('✅ Ajustes guardados.');
    } catch (e: any) { setMsg(`❌ ${e.message}`); }
    finally { setLoading(false); }
  };

  const importCsv = async () => {
    if (!authed) { setMsg('❌ Primero autentícate.'); return; }
    if (!csvText.trim()) { setMsg('Carga un CSV antes de importar.'); return; }
    setLoading(true); setMsg(null);
    try {
      const url = `/api/admin/schedule/import${replaceAll ? '?replace=1' : ''}`;
      const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/csv', ...headers() }, body: csvText });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.error || 'Error al importar');
      setMsg(`✅ Importación completa. Filas: ${j.inserted}${replaceAll ? ' (reemplazo total)' : ''}.`);
    } catch (e: any) { setMsg(`❌ ${e.message}`); }
    finally { setLoading(false); }
  };

  const onFile = async (f?: File) => { if (!f) return; setCsvText(await f.text()); };

  return (
    <main className="space-y-6">
      <section className="bg-white/5 border border-white/10 rounded-2xl p-6">
        <h2 className="text-lg font-semibold mb-3">Acceso administrador</h2>
        <div className="flex flex-wrap items-end gap-3">
          {!token && (
            <>
              <div className="min-w-[220px]">
                <label className="block text-sm mb-1 opacity-80">Contraseña admin (plan B)</label>
                <input type="password" value={adminPass} onChange={(e) => setAdminPass(e.target.value)} placeholder="••••••" className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/10" />
              </div>
              <a href="/auth/login" className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10">Iniciar sesión</a>
            </>
          )}
          {token && (
            <div className="text-xs opacity-80">
              Sesión: {me?.email} ({me?.role})
            </div>
          )}
          <button onClick={fetchTol} className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10" disabled={loading || (!token && !adminPass)}>
            Conectar
          </button>
        </div>
        {msg && <p className={`text-xs mt-3 ${authed ? 'text-green-300' : 'text-red-300'}`}>{msg}</p>}
      </section>

      <section className={`bg-white/5 border border-white/10 rounded-2xl p-6 ${authed ? '' : 'opacity-50 pointer-events-none'}`}>
        <h3 className="text-base font-medium mb-3">Reglas de tiempo</h3>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs mb-1 opacity-80">Tolerancia (min)</label>
            <input type="number" min={0} max={240} value={tol} onChange={(e) => setTol(e.target.value === '' ? '' : Number(e.target.value))} placeholder="15" className="w-24 px-3 py-2 rounded-lg bg-white/10 border border-white/10" />
          </div>
          <div>
            <label className="block text-xs mb-1 opacity-80">Umbral de tardanza (min)</label>
            <input type="number" min={0} max={240} value={late} onChange={(e) => setLate(e.target.value === '' ? '' : Number(e.target.value))} placeholder="30" className="w-28 px-3 py-2 rounded-lg bg-white/10 border border-white/10" />
          </div>
          <button onClick={saveTol} className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10" disabled={loading || !authed}>Guardar</button>
        </div>
      </section>

      <section className={`bg-white/5 border border-white/10 rounded-2xl p-6 ${authed ? '' : 'opacity-50 pointer-events-none'}`}>
        <h3 className="text-base font-medium mb-3">Cargar horarios (CSV)</h3>
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <input type="file" accept=".csv,text/csv" onChange={(e) => onFile(e.target.files?.[0] || undefined)} className="block" />
          <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={replaceAll} onChange={(e) => setReplaceAll(e.target.checked)} /> Reemplazar todo</label>
          <button onClick={importCsv} className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10" disabled={loading || !authed}>Importar</button>
        </div>
        <textarea rows={8} className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/10 text-xs" placeholder="Pega aquí el CSV si lo prefieres…" value={csvText} onChange={(e) => setCsvText(e.target.value)} />
      </section>
    </main>
  );
}