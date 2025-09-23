// app/teacher/sessions/[id]/page.tsx
import { supabaseAdmin } from "@/lib/supabase/adminClient";
import SessionDetailClient from "./session-client";

export const runtime = "nodejs";

export default async function SessionDetailPage({ params }: { params: { id: string } }) {
  const sessionId = Number(params.id);
  if (!Number.isFinite(sessionId)) {
    return <div className="p-6 text-red-600">ID de sesión inválido.</div>;
  }

  const { data: ses, error: sErr } = await supabaseAdmin
    .from("sessions")
    .select("id, session_code, session_date, start_planned, started_at")
    .eq("id", sessionId)
    .maybeSingle();

  if (sErr) return <div className="p-6 text-red-600">Error: {sErr.message}</div>;
  if (!ses) return <div className="p-6">Sesión no encontrada.</div>;

  // Cargar asistencia inicial
  const { data: rows, error: aErr } = await supabaseAdmin
    .from("attendance")
    .select("id, student_id, student_name, status, updated_at")
    .eq("session_id", sessionId)
    .order("updated_at", { ascending: false });

  if (aErr) return <div className="p-6 text-red-600">Error: {aErr.message}</div>;

  return (
    <SessionDetailClient
      session={ses}
      initialAttendance={rows ?? []}
    />
  );
}
