// app/scan/new/page.tsx
import { createSupabaseServerClient } from "@/lib/supabase/serverClient";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ScanNewPage({
  searchParams,
}: {
  searchParams: { room?: string };
}) {
  const room = searchParams.room || "";
  const supabase = createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;

  if (!user) {
    return (
      <div className="max-w-xl mx-auto p-6">
        <h1 className="text-xl font-semibold mb-4">Necesitas iniciar sesión</h1>
        <Link href="/login" className="underline">Ir a login</Link>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Crear sesión manual</h1>
      <p className="opacity-80">
        No encontramos una sesión activa para el salón <b>{room || "—"}</b>.
      </p>
      <p>¿Quieres crear una sesión manual iniciando ahora mismo?</p>

      <form action={`/api/sessions/create-manual?room=${encodeURIComponent(room)}`} method="post">
        <button
          type="submit"
          className="px-4 py-2 rounded border shadow-sm"
        >
          Crear sesión manual ahora
        </button>
      </form>

      <div className="text-sm opacity-60">
        Esto asignará la sesión al docente actual, marcará el inicio real con la hora de ahora y ligará el salón del QR.
      </div>

      <Link href="/qr" className="text-sm underline">Regresar</Link>
    </div>
  );
}
