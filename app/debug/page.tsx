'use client';

import { useState } from 'react';

export default function Page() {
  const [roomId, setRoomId] = useState('A-101');
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const probar = async () => {
    setLoading(true);
    setErr(null);
    setData(null);
    try {
      const r = await fetch(`/api/schedule/resolve?roomId=${encodeURIComponent(roomId)}`);
      const j = await r.json();
      setData(j);
    } catch (e: any) {
      setErr(String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="max-w-xl mx-auto bg-white/5 border border-white/10 rounded-2xl p-6">
      <h1 className="text-lg font-semibold mb-4">Prueba de API · Resolver sesión por salón</h1>
      <div className="flex gap-2 mb-3">
        <input
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
          placeholder="A-101"
          className="flex-1 px-3 py-2 rounded-lg bg-white/10 border border-white/10"
        />
        <button onClick={probar} className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/10">
          Probar
        </button>
      </div>
      {loading && <div>Consultando…</div>}
      {err && <div className="text-red-300 text-sm">Error: {err}</div>}
      {data && (
        <pre className="text-xs whitespace-pre-wrap bg-black/30 p-3 rounded-lg border border-white/10">
{JSON.stringify(data, null, 2)}
        </pre>
      )}
    </main>
  );
}
