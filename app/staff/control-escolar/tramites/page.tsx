// app/staff/control-escolar/tramites/page.tsx
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function TramitesPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Trámites</h1>
      <div className="border rounded p-4 text-sm opacity-70">
        Próximamente: constancias, bajas/altas, revalidaciones, etc.
      </div>
    </div>
  );
}
