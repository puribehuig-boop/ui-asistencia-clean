// app/staff/control-escolar/profesores/export/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/adminClient";

function toInt(v?: string | null) {
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const termId = toInt(url.searchParams.get("termId"));
  const subjectId = toInt(url.searchParams.get("subjectId"));
  const groupId = toInt(url.searchParams.get("groupId"));
  const status = (url.searchParams.get("status") ?? "").trim();

  // Filtrar grupos para determinar profesores vinculados
  let grp = supabaseAdmin.from("Group").select("id, teacher_user_id, subjectId, termId").not("teacher_user_id", "is", null);
  if (termId != null) grp = grp.eq("termId", termId);
  if (subjectId != null) grp = grp.eq("subjectId", subjectId);
  const { data: groups } = await grp;

  const teacherIds = new Set<string>();
  (groups ?? []).forEach((g: any) => {
    if (groupId != null && g.id !== groupId) return;
    if (g.teacher_user_id) teacherIds.add(g.teacher_user_id);
  });

  // Perfiles de docentes
  let profsQuery = supabaseAdmin.from("profiles").select("user_id, email, role").eq("role", "docente").order("email", { ascending: true });
  if (teacherIds.size) profsQuery = profsQuery.in("user_id", Array.from(teacherIds));
  if (q) profsQuery = profsQuery.ilike("email", `%${q}%`);
  const { data: profs } = await profsQuery;

  const ids = (profs ?? []).map((p) => p.user_id);
  let tpById = new Map<string, { first_name: string | null; last_name: string | null; status: string | null }>();
  if (ids.length) {
    let tpq = supabaseAdmin.from("teacher_profile").select("user_id, first_name, last_name, status").in("user_id", ids);
    if (status) tpq = tpq.eq("status", status);
    const { data: tps } = await tpq;
    (tps ?? []).forEach((t: any) => tpById.set(t.user_id, { first_name: t.first_name, last_name: t.last_name, status: t.status ?? null }));
  }

  let rows = (profs ?? [])
    .filter((p) => !status || (tpById.get(p.user_id)?.status ?? "") === status)
    .map((p: any) => {
      const tp = tpById.get(p.user_id);
      const name = [tp?.first_name, tp?.last_name].filter(Boolean).join(" ");
      return { user_id: p.user_id as string, name, email: p.email as string, status: tp?.status ?? "" };
    });

  if (q) {
    const qLower = q.toLowerCase();
    rows = rows.filter((r) => r.email.toLowerCase().includes(qLower) || (r.name || "").toLowerCase().includes(qLower));
  }

  const header = ["user_id", "name", "email", "status"];
  const csv = [header.join(",")]
    .concat(rows.map((r) => [r.user_id, JSON.stringify(r.name ?? ""), JSON.stringify(r.email ?? ""), JSON.stringify(r.status ?? "")].join(",")))
    .join("\n");

  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="profesores.csv"`,
    },
  });
}
