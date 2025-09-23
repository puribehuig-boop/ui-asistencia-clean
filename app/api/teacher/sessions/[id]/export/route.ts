// app/api/teacher/sessions/[id]/export/route.ts
import { supabaseAdmin } from "@/lib/supabase/adminClient";

export const runtime = "nodejs";

function toCsv(rows: any[]) {
  const header = ["student_id", "student_name", "status", "updated_at"];
  const escape = (v: any) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push([r.student_id, r.student_name, r.status, r.updated_at].map(escape).join(","));
  }
  return lines.join("\n");
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const sessionId = Number(params.id);
  if (!Number.isFinite(sessionId)) {
    return new Response("sessionId inválido", { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("attendance")
    .select("student_id, student_name, status, updated_at")
    .eq("session_id", sessionId)
    .order("student_id");

  if (error) return new Response(error.message, { status: 500 });

  const csv = toCsv(data ?? []);
  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="attendance_session_${sessionId}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
