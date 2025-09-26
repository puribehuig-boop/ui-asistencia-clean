// app/staff/control-escolar/alumnos/export/route.ts
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
  const programId = toInt(url.searchParams.get("programId"));
  const subjectId = toInt(url.searchParams.get("subjectId"));
  const groupId = toInt(url.searchParams.get("groupId"));

  // Subjects por programa
  let subjectIdsByProgram: number[] | null = null;
  if (programId != null) {
    const { data: ps } = await supabaseAdmin
      .from("ProgramSubject")
      .select("subjectId")
      .eq("programId", programId);
    subjectIdsByProgram = (ps ?? []).map((r: any) => r.subjectId).filter((v: any) => v != null);
  }

  // Grupos efectivos
  let grpQuery = supabaseAdmin.from("Group").select("id, subjectId, termId");
  if (termId != null) grpQuery = grpQuery.eq("termId", termId);
  if (subjectId != null) grpQuery = grpQuery.eq("subjectId", subjectId);
  else if (programId != null && subjectIdsByProgram && subjectIdsByProgram.length) {
    grpQuery = grpQuery.in("subjectId", subjectIdsByProgram);
  }
  const { data: groups } = await grpQuery;
  const groupIds = groupId != null ? [groupId] : Array.from(new Set((groups ?? []).map((g: any) => g.id)));

  // Alumnos candidatos por v_group_roster (si hay filtros), sino por profiles (rol)
  let candidateStudentIds: string[] = [];
  if (groupIds.length) {
    const { data: roster } = await supabaseAdmin
      .from("v_group_roster")
      .select("student_id_text")
      .in("group_id", groupIds)
      .limit(10000);
    candidateStudentIds = Array.from(new Set((roster ?? []).map((r: any) => r.student_id_text)));
  }

  let profilesQuery = supabaseAdmin
    .from("profiles")
    .select("user_id, email, role")
    .in("role", ["alumno", "student"])
    .order("email", { ascending: true });

  if (candidateStudentIds.length) profilesQuery = profilesQuery.in("user_id", candidateStudentIds);
  if (q) profilesQuery = profilesQuery.ilike("email", `%${q}%`);
  const { data: profs } = await profilesQuery;

  const ids = (profs ?? []).map((p) => p.user_id);
  let nameByUser: Record<string, string> = {};
  if (ids.length) {
    const { data: sps } = await supabaseAdmin
      .from("StudentProfile")
      .select('userId, fullName, "first_name","last_name"')
      .in("userId", ids);
    (sps ?? []).forEach((sp: any) => {
      const name = sp.fullName || [sp.first_name, sp.last_name].filter(Boolean).join(" ");
      nameByUser[sp.userId] = (name || "").trim();
    });
  }

  let rows = (profs ?? []).map((p: any) => ({
    user_id: p.user_id as string,
    email: p.email as string,
    name: nameByUser[p.user_id] ?? "",
  }));

  if (q) {
    const qLower = q.toLowerCase();
    rows = rows.filter(
      (r) => r.email.toLowerCase().includes(qLower) || (r.name || "").toLowerCase().includes(qLower)
    );
  }

  const header = ["user_id", "name", "email"];
  const lines = [header.join(",")].concat(
    rows.map((r) =>
      [r.user_id, JSON.stringify(r.name ?? ""), JSON.stringify(r.email ?? "")].join(",")
    )
  );
  const csv = lines.join("\n");

  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="alumnos.csv"`,
    },
  });
}
