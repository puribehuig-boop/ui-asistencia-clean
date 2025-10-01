// app/staff/control-escolar/page.tsx
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ControlEscolarHome() {
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Control escolar</h1>
      <p className="text-sm opacity-70">Selecciona una sección en la barra lateral: Alumnos, Profesores o Trámites.</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <a href="/staff/control-escolar/alumnos" className="border rounded p-4 hover:bg-gray-50">
          <div className="font-medium mb-1">Alumnos</div>
          <div className="text-xs opacity-60">Buscar y consultar: Información/Documentos, Historial, Boletas, Horarios, Asistencia.</div>
        </a>
        <a href="/staff/control-escolar/profesores" className="border rounded p-4 hover:bg-gray-50">
          <div className="font-medium mb-1">Profesores</div>
          <div className="text-xs opacity-60">Buscar y consultar: Asistencia, Información/Documentos, Horarios.</div>
        </a>
        <a href="/staff/control-escolar/tramites" className="border rounded p-4 hover:bg-gray-50">
          <div className="font-medium mb-1">Trámites</div>
          <div className="text-xs opacity-60">Futuras implementaciones.</div>
        </a>
        <Link href="/staff/control-escolar/justificaciones" className="block px-2 py-1 rounded hover:bg-gray-50">
  Justificaciones
</Link>
      </div>
    </div>
  );
}
