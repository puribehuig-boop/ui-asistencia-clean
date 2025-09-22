import { Suspense } from 'react';
import SessionDemoClient from './SessionDemoClient';

export const dynamic = 'force-dynamic';

export default function Page() {
  return (
    <Suspense fallback={<main className="p-6">Cargando sesión…</main>}>
      <SessionDemoClient />
    </Suspense>
  );
}

