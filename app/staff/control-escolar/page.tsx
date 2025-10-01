// app/staff/control-escolar/page.tsx
import Link from "next/link";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ControlEscolarHome() {
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Control escolar</h1>
      <p className="text-sm opacity-70">Selecciona una sección en la barra lateral o desde las tarjetas.</p>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <a href="/staff/control-escolar/alumnos" className="border rounded p-4 hover:bg-gray-50 block">
          <div className="font-medium mb-1">Alumnos</div>
          <div className="text-xs opacity-60">Información/Docs, Historial, Boletas, Horarios, Asistencia.</div>
        </a>

        <a href="/staff/control-escolar/profesores" className="border rounded p-4 hover:bg-gray-50 block">
          <div className="font-medium mb-1">Profesores</div>
          <div className="text-xs opacity-60">Asistencia, Información/Docs, Horarios.</div>
        </a>

        <a href="/staff/control-escolar/tramites" className="border rounded p-4 hover:bg-gray-50 block">
          <div className="font-medium mb-1">Trámites</div>
          <div className="text-xs opacity-60">Futuras implementaciones.</div>
        </a>

        <Link href="/staff/control-escolar/justificaciones" className="border rounded p-4 hover:bg-gray-50 block">
          <div className="font-medium mb-1">Justificaciones</div>
          <div className="text-xs opacity-60">Revisión de solicitudes, evidencia y resolución.</div>
        </Link>
      </div>
    </div>
  );
}
