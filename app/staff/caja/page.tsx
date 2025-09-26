// app/staff/caja/page.tsx
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CajaPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Caja</h1>
      <p className="text-sm opacity-70">Aquí irá el módulo de pagos, becas, y estado de cuenta.</p>

      <div className="border rounded p-4">
        <div className="text-sm font-medium mb-2">Próximos pasos</div>
        <ul className="list-disc pl-6 text-sm space-y-1">
          <li>Tablas: students_accounts, invoices, payments, scholarships.</li>
          <li>Conciliación manual / carga de comprobantes.</li>
          <li>Exportar reportes CSV.</li>
        </ul>
      </div>
    </div>
  );
}
