import { Suspense } from 'react';
import QRPageClient from './QRPageClient';

export const dynamic = 'force-dynamic';

export default function Page() {
  return (
    <Suspense fallback={<main className="p-6">Generando QR…</main>}>
      <QRPageClient />
    </Suspense>
  );
}
