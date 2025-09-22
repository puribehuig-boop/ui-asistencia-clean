// app/admin/error.tsx
'use client';

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="max-w-xl mx-auto p-6">
      <h1 className="text-xl font-semibold mb-3">Error en Admin</h1>
      <pre className="text-xs p-3 bg-black/5 rounded mb-4 whitespace-pre-wrap">
        {error.message || String(error)}
      </pre>
      <button className="border rounded px-3 py-1" onClick={() => reset()}>
        Reintentar
      </button>
    </main>
  );
}
