// app/admin/page.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default async function AdminHome() {
  return (
    <main className="bg-white/5 border border-white/10 rounded-2xl p-6">
      <h2 className="text-lg font-semibold mb-4">Bienvenido al panel</h2>
      <p className="opacity-80 mb-4">
        Si ves esto, el layout te dejó pasar (sesión + rol admin OK) y la página se está
        renderizando.
      </p>

      <div className="grid gap-3 text-sm">
        <a className="underline underline-offset-2" href="/admin/programs">→ Programas</a>
        <a className="underline underline-offset-2" href="/admin/subjects">→ Materias</a>
        <a className="underline underline-offset-2" href="/admin/terms">→ Periodos</a>
        <a className="underline underline-offset-2" href="/admin/groups">→ Grupos</a>
      </div>
    </main>
  );
}
