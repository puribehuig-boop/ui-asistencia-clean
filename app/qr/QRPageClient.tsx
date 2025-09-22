'use client';

import { useSearchParams } from 'next/navigation';
import { useMemo } from 'react';

export default function QRPageClient() {
  const params = useSearchParams();
  const roomId = params.get('roomId') ?? 'A-101';

  const targetUrl = useMemo(() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return `${origin}/scan?roomId=${encodeURIComponent(roomId)}`;
  }, [roomId]);

  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=440x440&data=${encodeURIComponent(targetUrl)}`;

  return (
    <main className="min-h-[70vh] flex flex-col items-center justify-center gap-4">
      <h1 className="text-lg font-semibold">QR permanente del salón: {roomId}</h1>
      <img src={qrSrc} alt={`QR ${roomId}`} className="bg-white p-3 rounded-xl" />
      <button
        onClick={() => window.print()}
        className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10"
      >
        Imprimir
      </button>
      <p className="text-xs opacity-70">{targetUrl}</p>
    </main>
  );
}
