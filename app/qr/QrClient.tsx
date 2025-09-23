"use client";

import { useEffect, useMemo, useRef, useState } from "react";

function QrCanvas({ text, size = 256, dataUrl }: { text: string; size?: number; dataUrl: string }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    let mounted = true;
    (async () => {
      const QR: any = await import("qrcode"); // tipos resueltos con types/qrcode.d.ts
      if (!mounted || !ref.current) return;
      await QR.toCanvas(ref.current, text, { margin: 1, width: size });
      // marca el canvas para la descarga
      ref.current.setAttribute("data-url", dataUrl);
    })();
    return () => {
      mounted = false;
    };
  }, [text, size, dataUrl]);
  return <canvas ref={ref} width={size} height={size} className="border rounded bg-white" />;
}

function QrCard({ label, url, size = 256 }: { label: string; url: string; size?: number }) {
  const onDownload = () => {
    const canvas = document.querySelector<HTMLCanvasElement>(`canvas[data-url="${url}"]`);
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `${label}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  return (
    <div className="p-4 border rounded flex flex-col items-center gap-3 print:break-inside-avoid">
      <div className="text-sm opacity-80">{label}</div>
      <QrCanvas text={url} size={size} dataUrl={url} />
      <div className="text-xs break-all text-center max-w-[320px]">{url}</div>
      <div className="flex gap-2 no-print">
        <button onClick={() => navigator.clipboard.writeText(url)} className="px-3 py-1 border rounded">
          Copiar enlace
        </button>
        <button onClick={onDownload} className="px-3 py-1 border rounded">
          Descargar PNG
        </button>
      </div>
    </div>
  );
}

export default function QrClient({
  origin,
  rooms,
  initialRoomId,
}: {
  origin: string;
  rooms: string[];
  initialRoomId?: string;
}) {
  const [room, setRoom] = useState<string>(initialRoomId || (rooms[0] || ""));
  const [showAll, setShowAll] = useState<boolean>(!initialRoomId); // si llega ?roomId, por defecto muestra individual
  const makeUrl = (r: string) => `${origin}/scan?roomId=${encodeURIComponent(r)}`;
  const singleUrl = useMemo(() => (room ? makeUrl(room) : ""), [room, origin]);

  useEffect(() => {
    if (initialRoomId && rooms.includes(initialRoomId)) setRoom(initialRoomId);
  }, [initialRoomId, rooms]);

  return (
    <div className="p-6 space-y-6">
      <div className="no-print">
        <h1 className="text-2xl font-semibold">Códigos QR por salón</h1>
        <p className="text-sm opacity-70">
          Al escanear, se redirige a <code>/teacher/sessions/&lt;id&gt;</code> de la sesión vigente del salón.
        </p>
      </div>

      {/* Selector individual */}
      <div className="no-print border rounded p-4 space-y-3">
        <h2 className="font-medium">Generar QR individual</h2>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-sm">Salón:</label>
          <select
          className="border border-gray-300 rounded px-2 py-1 bg-white text-black"
          value={room}
          onChange={(e) => setRoom(e.target.value)}
          >
            {rooms.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <button className="px-3 py-1 border rounded" onClick={() => window.print()}>
            Imprimir
          </button>
        </div>
        {singleUrl && <QrCard label={room} url={singleUrl} />}
      </div>

      {/* Hoja con todos los salones */}
      <div className="no-print border rounded p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">Hoja con todos los salones</h2>
          <label className="text-sm flex items-center gap-2">
            <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
            Mostrar
          </label>
        </div>
        {showAll && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {rooms.map((r) => (
                <QrCard key={r} label={r} url={makeUrl(r)} />
              ))}
            </div>
            <div className="no-print">
              <button className="mt-3 px-3 py-1 border rounded" onClick={() => window.print()}>
                Imprimir hoja completa
              </button>
            </div>
          </>
        )}
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; }
          .print\\:break-inside-avoid { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>
    </div>
  );
}
