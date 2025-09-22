import { Suspense } from 'react';
import ScanClient from './ScanClient';

export const dynamic = 'force-dynamic';

export default function Page() {
  return (
    <Suspense fallback={<main className="p-6">Validando salón…</main>}>
      <ScanClient />
    </Suspense>
  );
}
