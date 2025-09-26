// app/staff/admissions/page.tsx
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdmissionsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Admisiones (CRM)</h1>
      <p className="text-sm opacity-70">
        Aquí irá el pipeline de leads, seguimiento, y conversión a alumnos.
      </p>

      <div className="border rounded p-4">
        <div className="text-sm font-medium mb-2">Resumen</div>
        <ul className="list-disc pl-6 text-sm space-y-1">
          <li>Leads nuevos (hoy): —</li>
          <li>En seguimiento: —</li>
          <li>Convertidos este mes: —</li>
        </ul>
      </div>

      <div className="border rounded p-4">
        <div className="text-sm font-medium mb-2">Siguientes pasos</div>
        <div className="text-xs opacity-60">Diseñar tablas leads/activities/contact_methods o conectar CRM externo.</div>
      </div>
    </div>
  );
}
