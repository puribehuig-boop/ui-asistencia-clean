// app/teacher/sessions/[id]/page.tsx
import { supabaseAdmin } from "@/lib/supabase/adminClient";
import SessionRosterClient from "./session-roster-client";

export const runtime = "nodejs";

export default async function SessionDetailPage({ params }: { params: { id: string } }) {
  const sessionId = Number(params.id);
  if (!Number.isFinite(sessionId)) return <div className="p-6 text-red-600">ID de sesión inválido.</div>;

  const { data: ses, error: sErr } = await supabaseAdmin
    .from("sessions")
    .select("id, session_code, session_date, start_planned, started_at")
    .eq("id", sessionId)
    .maybeSingle();
  if (sErr) return <div className="p-6 text-red-600">Error: {sErr.message}</div>;
  if (!ses) return <div className="p-6">Sesión no encontrada.</div>;

  const { data: gs } = await supabaseAdmin
    .from("global_settings")
    .select("attendance_tolerance_min, late_threshold_min")
    .eq("id", 1)
    .maybeSingle();

  return <SessionRosterClient session={ses} settings={gs || null} />;
}
