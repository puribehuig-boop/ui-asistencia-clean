// app/teacher/sessions/page.tsx
import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/adminClient";

export const runtime = "nodejs";

type Ses = {
  id: number;
  session_code: string | null;
  session_date: string | null;
  start_planned: string | null;
  started_at: string | null;
};

function hhmmToTime(hhmm?: string | null) {
  if (!hhmm) return "";
  const m = (hhmm || "").match(/^(\d{2})(\d{2})$/);
  if (!m) return hhmm || "";
  return `${m[1]}:${m[2]}`;
}

export default async function TeacherSessionsPage() {
  const { data: sessions, error } = await supabaseAdmin
    .from("sessions")
    .select("id, session_code, session_date, start_planned, started_at")
    .order("session_date", { ascending: false })
    .order("id", { ascending: false })
    .limit(30);

  if (error) {
    return <div className="p-6 text-red-600">Error cargando sesiones: {error.message}</div>;
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Sesiones</h1>
      <p className="text-sm opacity-70">Selecciona una sesión para marcar asistencia o exportar.</p>

      <div className="border rounded overflow-hidden">
        <div className="grid grid-cols-6 gap-2 p-3 text-sm font-semibold bg-gray-100 text-black">
          <div>ID</div>
          <div>Código</div>
          <div>Fecha</div>
          <div>Hora</div>
          <div>Acciones</div>
          <div>Exportar</div>
        </div>

        {sessions?.map((s: Ses) => (
          <div key={s.id} className="grid grid-cols-6 gap-2 p-3 border-t text-sm items-center">
            <div>{s.id}</div>
            <div className="truncate">{s.session_code ?? "—"}</div>
            <div>{s.session_date ?? "—"}</div>
            <div>{hhmmToTime(s.start_planned)}</div>
            <div>
              <Link className="underline" href={`/teacher/sessions/${s.id}`}>Abrir</Link>
            </div>
            <div>
              <a className="underline" href={`/api/teacher/sessions/${s.id}/export`}>CSV</a>
            </div>
          </div>
        ))}

        {(!sessions || sessions.length === 0) && (
          <div className="p-4 text-sm">No hay sesiones para mostrar.</div>
        )}
      </div>
    </div>
  );
}
