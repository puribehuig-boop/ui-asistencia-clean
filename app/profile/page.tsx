// app/profile/page.tsx
import { createSupabaseServerClient } from "@/lib/supabase/serverClient";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function hhmm(t?: string | null) {
  if (!t) return "—";
  const s = String(t);
  if (/^\d{4}$/.test(s)) return `${s.slice(0, 2)}:${s.slice(2, 4)}`;
  if (/^\d{2}:\d{2}/.test(s)) return s.slice(0, 5);
  return s;
}
function ymdToDate(ymd?: string | null) {
  if (!ymd) return null;
  const [y, m, d] = ymd.split("-").map((n) => Number(n));
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function combineDateTime(ymd?: string | null, t?: string | null) {
  const d = ymdToDate(ymd);
  if (!d) return null;
  if (!t) return d;

  const s = String(t);
  let h = 0, m = 0;

  if (/^\d{4}$/.test(s)) {
    // "HHmm"
    h = Number(s.slice(0, 2));
    m = Number(s.slice(2, 4));
  } else if (/^\d{2}:\d{2}(:\d{2})?$/.test(s)) {
    // "HH:MM" o "HH:MM:SS"
    const [hh, mm] = s.split(":");
    h = Number(hh);
    m = Number(mm);
  } else {
    // formato desconocido: usa medianoche
    return d;
  }
  d.setHours(h, m, 0, 0);
  return d;
}


function TabNav({ tab, tabs }: { tab: string; tabs: { key: string; label: string }[] }) {
  return (
    <div className="flex gap-2 border-b">
      {tabs.map((t) => (
        <a
          key={t.key}
          href={`/profile?tab=${t.key}`}
          className={`px-3 py-2 text-sm ${tab === t.key ? "border-b-2 border-black font-medium" : "opacity-70"}`}
        >
          {t.label}
        </a>
      ))}
    </div>
  );
}

export default async function ProfilePage({ searchParams }: { searchParams?: { tab?: string } }) {
  const supabase = createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) redirect("/login");

  const tab = (searchParams?.tab ?? "").toLowerCase() || "resumen";

  // Perfil base (correo + rol)
  const { data: me } = await supabase
    .from("profiles")
    .select("email, role")
    .eq("user_id", auth.user.id)
    .maybeSingle();

  const email = me?.email ?? auth.user.email ?? "";
  const role = (me?.role ?? "").toLowerCase();

  /** ========================= ALUMNO ========================= */
  if (role === "alumno" || role === "student") {
    // 1) StudentProfile (id numérico + nombre)
    const { data: sp } = await supabase
      .from("StudentProfile")
      .select('id, "userId", "fullName", "first_name", "last_name"')
      .eq("userId", auth.user.id)
      .maybeSingle();

    const studentName =
      sp?.fullName ||
      [sp?.first_name, sp?.last_name].filter(Boolean).join(" ") ||
      email;

    // 2) Camino canónico: Enrollment -> Group -> Sessions
    let groupIds: number[] = [];
    if (sp?.id != null) {
      const { data: enr } = await supabase
        .from("Enrollment")
        .select('"groupId"')
        .eq("studentId", sp.id);
      groupIds = Array.from(new Set((enr ?? []).map((r: any) => Number(r.groupId)).filter(Boolean)));
    }

    // 3) Catálogos y sesiones (canónico)
    let groups: any[] = [];
    let sessions: any[] = [];
    const subjectMap = new Map<number, string>();
    const termMap = new Map<number, string>();

    if (groupIds.length) {
      const { data: gRows } = await supabase
        .from("Group")
        .select("id, code, subjectId, termId, teacher_user_id")
        .in("id", groupIds);
      groups = gRows ?? [];

      const subjIds = Array.from(new Set(groups.map((g: any) => g.subjectId).filter(Boolean)));
      const termIds = Array.from(new Set(groups.map((g: any) => g.termId).filter(Boolean)));

      if (subjIds.length) {
        const { data: subs } = await supabase.from("Subject").select("id, name").in("id", subjIds);
        (subs ?? []).forEach((s: any) => subjectMap.set(s.id, s.name ?? ""));
      }
      if (termIds.length) {
        const { data: terms } = await supabase.from("Term").select("id, name").in("id", termIds);
        (terms ?? []).forEach((t: any) => termMap.set(t.id, t.name ?? ""));
      }

      const { data: sRows } = await supabase
        .from("sessions")
        .select("id, session_date, start_planned, room_code, status, group_id, subjectId")
        .in("group_id", groupIds)
        .order("session_date", { ascending: false })
        .order("id", { ascending: false })
        .limit(200);
      sessions = sRows ?? [];
    }

    // 4) Fallback si no hay grupos o sesiones: construir desde asistencia
    if (!groupIds.length || (!groups.length && !sessions.length)) {
      // a) asistencia por uuid moderno
      const attUuid = await supabase
        .from("attendance")
        .select("session_id, status, updated_at")
        .eq("student_user_id", auth.user.id);

      // b) asistencia por llaves legacy (uuid en texto + StudentProfile.id)
      const candidateIds: string[] = [auth.user.id];
      if (sp?.id != null) candidateIds.push(String(sp.id));

      const attLegacy =
        candidateIds.length > 0
          ? await supabase
              .from("attendance")
              .select("session_id, status, updated_at")
              .in("student_id", candidateIds)
          : { data: [] as any[], error: null };

      const attRows = [...(attUuid.data ?? []), ...(attLegacy.data ?? [])];
      const sessionIdSet = new Set<number>((attRows ?? []).map((r: any) => Number(r.session_id)).filter(Boolean));

      if (sessionIdSet.size) {
        const ids = Array.from(sessionIdSet);
        const { data: sRows2 } = await supabase
          .from("sessions")
          .select("id, session_date, start_planned, room_code, status, group_id, subjectId")
          .in("id", ids);
        sessions = sRows2 ?? [];

        const derivedGroupIds = Array.from(
          new Set((sessions ?? []).map((s: any) => Number(s.group_id)).filter(Boolean))
        );
        if (derivedGroupIds.length) {
          const { data: gRows2 } = await supabase
            .from("Group")
            .select("id, code, subjectId, termId, teacher_user_id")
            .in("id", derivedGroupIds);
          groups = gRows2 ?? [];

          const subjIds2 = Array.from(new Set(groups.map((g: any) => g.subjectId).filter(Boolean)));
          const termIds2 = Array.from(new Set(groups.map((g: any) => g.termId).filter(Boolean)));

          if (subjIds2.length) {
            const { data: subs2 } = await supabase.from("Subject").select("id, name").in("id", subjIds2);
            (subs2 ?? []).forEach((s: any) => subjectMap.set(s.id, s.name ?? ""));
          }
          if (termIds2.length) {
            const { data: terms2 } = await supabase.from("Term").select("id, name").in("id", termIds2);
            (terms2 ?? []).forEach((t: any) => termMap.set(t.id, t.name ?? ""));
          }
        } else {
          const subjIds3 = Array.from(new Set((sessions ?? []).map((s: any) => s.subjectId).filter(Boolean)));
          if (subjIds3.length) {
            const { data: subs3 } = await supabase.from("Subject").select("id, name").in("id", subjIds3);
            (subs3 ?? []).forEach((s: any) => subjectMap.set(s.id, s.name ?? ""));
          }
        }
      }
    }

    // 5) Asistencia (más reciente gana)
    const attUuid2 = await supabase
      .from("attendance")
      .select("session_id, status, updated_at")
      .eq("student_user_id", auth.user.id);

    const candIds2: string[] = [auth.user.id];
    if (sp?.id != null) candIds2.push(String(sp.id));

    const attLegacy2 =
      candIds2.length > 0
        ? await supabase
            .from("attendance")
            .select("session_id, status, updated_at")
            .in("student_id", candIds2)
        : { data: [] as any[], error: null };

    const attRows2 = [...(attUuid2.data ?? []), ...(attLegacy2.data ?? [])];

    // Elegir por sesión la fila con mayor updated_at; en empate, prioriza Justificado
    const attBySession = new Map<number, { status: string; updated_at: string | null }>();
    const newer = (a?: string | null, b?: string | null) =>
      new Date(a ?? "1970-01-01T00:00:00Z").getTime() - new Date(b ?? "1970-01-01T00:00:00Z").getTime();

    for (const r of attRows2) {
      const prev = attBySession.get(r.session_id);
      if (!prev || newer(r.updated_at, prev.updated_at) > 0) {
        attBySession.set(r.session_id, { status: r.status, updated_at: r.updated_at ?? null });
      } else if (prev && r.status === "Justificado" && prev.status !== "Justificado") {
        attBySession.set(r.session_id, { status: r.status, updated_at: r.updated_at ?? null });
      }
    }

    // 5.b) Justificaciones existentes (solo con student_id)
    const sessionIdsForView = (sessions ?? []).map((s: any) => Number(s.id)).filter(Boolean);
    const candidateIdsForJust: string[] = [auth.user.id];
    if (sp?.id != null) candidateIdsForJust.push(String(sp.id));

    let myJustBySession = new Map<number, string>(); // session_id -> status
    if (sessionIdsForView.length && candidateIdsForJust.length) {
      try {
        const { data: justs } = await supabase
          .from("attendance_justifications")
          .select("session_id, status, student_id")
          .in("session_id", sessionIdsForView)
          .in("student_id", candidateIdsForJust);
        (justs ?? []).forEach((j: any) => {
          myJustBySession.set(Number(j.session_id), j.status);
        });
      } catch {}
    }

    // 6) Calificaciones finales por grupo (desde v_group_roster)
    const finalByGroup = new Map<number, number | null>();
    if (sp?.id != null && groupIds.length) {
      try {
        const { data: roster } = await supabase
          .from("v_group_roster")
          .select("group_id, student_id, final_grade")
          .in("group_id", groupIds)
          .eq("student_id", sp.id);
        (roster ?? []).forEach((r: any) => finalByGroup.set(Number(r.group_id), r.final_grade ?? null));
      } catch {
        // si la vista no existe en algún entorno, se dejan como null
      }
    }

    // 7) Derivados para tabs
    // Para la tabla "Mis materias": una fila por grupo (materia + grupo + periodo + calificación)
    const mySubjectRows = (groups ?? []).map((g: any) => ({
      groupId: Number(g.id),
      groupCode: g.code ?? `#${g.id}`,
      termName: g.termId ? (termMap.get(g.termId) ?? "—") : "—",
      subjectName: g.subjectId ? subjectMap.get(g.subjectId) ?? "—" : "—",
      finalGrade: finalByGroup.get(Number(g.id)) ?? null,
    }));

    const myClasses = (sessions ?? []).map((s: any) => {
      const sid = Number(s.id);
      const status = attBySession.get(sid)?.status ?? "—";
      const jst = myJustBySession.get(sid); // 'pending' | 'approved' | 'rejected' | undefined
      const canJustify = !jst && status !== "Justificado";
      return {
        id: sid,
        date: s.session_date ?? null,
        time: hhmm(s.start_planned ?? null),
        room: s.room_code ?? null,
        status: s.status ?? null,
        groupId: s.group_id ?? null,
        subjectName: s.subjectId ? subjectMap.get(s.subjectId) ?? null : null,
        myStatus: status,
        canJustify,
        justifyStatus: jst ?? null,
        startDate: ymdToDate(s.session_date ?? null),
        startAt: combineDateTime(s.session_date ?? null, s.start_planned ?? null),
      };
    });

    // Para "Resumen": próximas clases (top 3, futuras o de hoy)
    const now = new Date();
    const upcoming = myClasses
      .filter((c) => c.startDate && c.startDate.getTime() >= new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime())
      .sort((a, b) => (a.startDate!.getTime() - b.startDate!.getTime()))
      .slice(0, 3);

    const tabs = [
      { key: "resumen", label: "Resumen" },
      { key: "materias", label: "Mis materias" },
      { key: "clases", label: "Mis clases" },
    ];

    return (
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Mi perfil (Alumno)</h1>
            <div className="text-sm opacity-70">{email} · Rol: {role}</div>
          </div>
          <a href="/logout" className="px-3 py-2 border rounded text-sm">Cerrar sesión</a>
        </div>

        <TabNav tab={tab} tabs={tabs} />

        {/* ========== RESUMEN (dashboard) ========== */}
        {tab === "resumen" && (
          <section className="space-y-6">
            <div>
              <h2 className="text-lg font-medium mb-2">Mis próximas clases</h2>
              <div className="border rounded">
                <div className="grid grid-cols-12 bg-gray-50 px-3 py-2 text-sm font-medium">
                  <div className="col-span-4 text-black">Fecha</div>
                  <div className="col-span-3 text-black">Hora</div>
                  <div className="col-span-3 text-black">Materia</div>
                  <div className="col-span-2 text-black">Salón</div>
                </div>
                <div>
                  {upcoming.map((c) => (
                    <div key={c.id} className="grid grid-cols-12 border-t px-3 py-2 text-sm items-center">
                      <div className="col-span-4">{c.date ?? "—"}</div>
                      <div className="col-span-3">{c.time ?? "—"}</div>
                      <div className="col-span-3">{c.subjectName ?? "—"}</div>
                      <div className="col-span-2">{c.room ?? "—"}</div>
                    </div>
                  ))}
                  {!upcoming.length && <div className="p-4 text-sm opacity-70">No hay clases próximas.</div>}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <a href="#" className="border rounded p-4 hover:bg-gray-50 block">
                <div className="font-medium">Mis Trámites</div>
                <div className="text-sm opacity-70">Próximamente…</div>
              </a>
              <a href="#" className="border rounded p-4 hover:bg-gray-50 block">
                <div className="font-medium">Buzón de Atención Anónima</div>
                <div className="text-sm opacity-70">Próximamente…</div>
              </a>
            </div>
          </section>
        )}

        {/* ========== MATERIAS (Materia · Grupo · Periodo · Calificación) ========== */}
        {tab === "materias" && (
          <section className="space-y-2">
            <h2 className="text-lg font-medium">Mis materias</h2>
            <div className="border rounded">
              <div className="grid grid-cols-12 bg-gray-50 px-3 py-2 text-sm font-medium">
                <div className="col-span-5 text-black">Materia</div>
                <div className="col-span-3 text-black">Grupo</div>
                <div className="col-span-2 text-black">Periodo</div>
                <div className="col-span-2 text-black">Calificación Final</div>
              </div>
              <div>
                {mySubjectRows.map((row) => (
                  <div key={row.groupId} className="grid grid-cols-12 border-t px-3 py-2 text-sm items-center">
                    <div className="col-span-5">{row.subjectName ?? "—"}</div>
                    <div className="col-span-3">{row.groupCode ?? "—"}</div>
                    <div className="col-span-2">{row.termName ?? "—"}</div>
                    <div className="col-span-2">{row.finalGrade ?? "—"}</div>
                  </div>
                ))}
                {!mySubjectRows.length && <div className="p-4 text-sm opacity-70">Sin materias.</div>}
              </div>
            </div>
          </section>
        )}

        {/* ========== CLASES (tabla de asistencia + justificar) ========== */}
        {tab === "clases" && (
          <section className="space-y-2">
            <h2 className="text-lg font-medium">Mis clases</h2>
            <div className="border rounded">
              <div className="grid grid-cols-12 bg-gray-50 px-3 py-2 text-sm font-medium">
                <div className="col-span-3 text-black">Fecha</div>
                <div className="col-span-2 text-black">Hora</div>
                <div className="col-span-3 text-black">Materia</div>
                <div className="col-span-2 text-black">Salón</div>
                <div className="col-span-2 text-black">Mi estado</div>
              </div>
              <div>
                {myClasses.map((c) => (
                  <div key={c.id} className="grid grid-cols-12 border-t px-3 py-2 text-sm items-center">
                    <div className="col-span-3">{c.date ?? "—"}</div>
                    <div className="col-span-2">{c.time ?? "—"}</div>
                    <div className="col-span-3">{c.subjectName ?? "—"}</div>
                    <div className="col-span-2">{c.room ?? "—"}</div>
                    <div className="col-span-2 flex items-center gap-2">
                      <span
                        className="px-2 py-0.5 rounded text-white text-xs"
                        style={{
                          background:
                            c.myStatus === "Presente" ? "#16a34a" :
                            c.myStatus === "Tarde" ? "#f59e0b" :
                            c.myStatus === "Justificado" ? "#2563eb" :
                            c.myStatus === "Ausente" ? "#dc2626" : "#6b7280"
                        }}
                      >
                        {c.myStatus}
                      </span>

                      {c.justifyStatus && (
                        <span className="text-xs opacity-70">
                          {c.justifyStatus === "pending" && "Solicitud enviada"}
                          {c.justifyStatus === "approved" && "Justificación aprobada"}
                          {c.justifyStatus === "rejected" && "Justificación rechazada"}
                        </span>
                      )}

                      {c.canJustify && (
                        <a className="text-xs underline" href={`/justifications/new?sessionId=${c.id}`}>
                          Justificar
                        </a>
                      )}
                    </div>
                  </div>
                ))}
                {!myClasses.length && <div className="p-4 text-sm opacity-70">Sin clases.</div>}
              </div>
            </div>
          </section>
        )}
      </div>
    );
  }

  /** ========================= DOCENTE (igual que antes) ========================= */
  if (role === "docente") {
    const { data: tp } = await supabase
      .from("teacher_profile")
      .select("first_name, last_name, status")
      .eq("user_id", auth.user.id)
      .maybeSingle();

    const teacherName = [tp?.first_name, tp?.last_name].filter(Boolean).join(" ") || email;

    const { data: sessions } = await supabase
      .from("sessions")
      .select("id, session_date, start_planned, room_code, status, subjectId, group_id")
      .eq("teacher_user_id", auth.user.id)
      .order("session_date", { ascending: false })
      .order("id", { ascending: false })
      .limit(200);

    const subjIds = Array.from(new Set((sessions ?? []).map((s: any) => s.subjectId).filter(Boolean)));
    const subjMap = new Map<number, string>();
    if (subjIds.length) {
      const { data: subs } = await supabase.from("Subject").select("id, name").in("id", subjIds);
      (subs ?? []).forEach((s: any) => subjMap.set(s.id, s.name ?? ""));
    }

    const { data: tGroups } = await supabase
      .from("Group")
      .select("id, code, subjectId, termId")
      .eq("teacher_user_id", auth.user.id);

    const termIds = Array.from(new Set((tGroups ?? []).map((g: any) => g.termId).filter(Boolean)));
    const termMap = new Map<number, string>();
    if (termIds.length) {
      const { data: terms } = await supabase.from("Term").select("id, name").in("id", termIds);
      (terms ?? []).forEach((t: any) => termMap.set(t.id, t.name ?? ""));
    }

    const mySessions = (sessions ?? []).map((s: any) => ({
      id: s.id as number,
      date: s.session_date ?? null,
      time: hhmm(s.start_planned ?? null),
      room: s.room_code ?? null,
      status: s.status ?? null,
      subjectName: s.subjectId ? (subjMap.get(s.subjectId) ?? null) : null,
    }));

    const mySubjects = Array.from(
      new Map((tGroups ?? []).map((g: any) => [g.subjectId, { id: g.subjectId, name: subjMap.get(g.subjectId) ?? "—" }])).values()
    );
    const tabs = [
      { key: "perfil", label: "Perfil" },
      { key: "clases", label: "Mis clases" },
      { key: "materias", label: "Mis materias" },
      { key: "grupos", label: "Mis grupos" },
    ];

    return (
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Mi perfil (Docente)</h1>
            <div className="text-sm opacity-70">{email} · Rol: {role}</div>
          </div>
          <a href="/logout" className="px-3 py-2 border rounded text-sm">Cerrar sesión</a>
        </div>

        <TabNav tab={tab} tabs={tabs} />

        {tab === "perfil" && (
          <section className="space-y-2">
            <h2 className="text-lg font-medium">Perfil</h2>
            <div className="border rounded p-3 text-sm">
              <div><b>Nombre:</b> {teacherName || "—"}</div>
              <div><b>Estatus:</b> {tp?.status ?? "—"}</div>
              <div><b>Correo:</b> {email}</div>
            </div>
          </section>
        )}

        {tab === "clases" && (
          <section className="space-y-2">
            <h2 className="text-lg font-medium">Mis clases</h2>
            <div className="border rounded">
              <div className="grid grid-cols-12 bg-gray-50 px-3 py-2 text-sm font-medium">
                <div className="col-span-3 text-black">Fecha</div>
                <div className="col-span-2 text-black">Hora</div>
                <div className="col-span-3 text-black">Materia</div>
                <div className="col-span-2 text-black">Salón</div>
                <div className="col-span-2 text-black">Acciones</div>
              </div>
              <div>
                {mySessions.map((s) => (
                  <div key={s.id} className="grid grid-cols-12 border-t px-3 py-2 text-sm items-center">
                    <div className="col-span-3">{s.date ?? "—"}</div>
                    <div className="col-span-2">{s.time ?? "—"}</div>
                    <div className="col-span-3">{s.subjectName ?? "—"}</div>
                    <div className="col-span-2">{s.room ?? "—"}</div>
                    <div className="col-span-2">
                      <a className="px-2 py-1 border rounded text-xs" href={`/teacher/sessions/${s.id}`}>Abrir</a>
                    </div>
                  </div>
                ))}
                {!mySessions.length && <div className="p-4 text-sm opacity-70">Sin sesiones.</div>}
              </div>
            </div>
          </section>
        )}

        {tab === "materias" && (
          <section className="space-y-2">
            <h2 className="text-lg font-medium">Mis materias</h2>
            <div className="border rounded">
              <div className="grid grid-cols-12 bg-gray-50 px-3 py-2 text-sm font-medium">
                <div className="col-span-8 text-black">Materia</div>
                <div className="col-span-4 text-black">Acciones</div>
              </div>
              <div>
                {mySubjects.map((s: any) => (
                  <div key={s.id} className="grid grid-cols-12 border-t px-3 py-2 text-sm items-center">
                    <div className="col-span-8">{s.name ?? "—"}</div>
                    <div className="col-span-4"><span className="text-xs opacity-60">—</span></div>
                  </div>
                ))}
                {!mySubjects.length && <div className="p-4 text-sm opacity-70">Sin materias.</div>}
              </div>
            </div>
          </section>
        )}

        {tab === "grupos" && (
          <section className="space-y-2">
            <h2 className="text-lg font-medium">Mis grupos</h2>
            <div className="border rounded">
              <div className="grid grid-cols-12 bg-gray-50 px-3 py-2 text-sm font-medium">
                <div className="col-span-4 text-black">Grupo</div>
                <div className="col-span-4 text-black">Materia</div>
                <div className="col-span-4 text-black">Periodo</div>
              </div>
              <div>
                {(await supabase
                  .from("Group")
                  .select("id, code, subjectId, termId")
                  .eq("teacher_user_id", auth.user.id)).data?.map((g: any) => (
                  <div key={g.id} className="grid grid-cols-12 border-t px-3 py-2 text-sm items-center">
                    <div className="col-span-4">{g.code ?? `#${g.id}`}</div>
                    <div className="col-span-4">{g.subjectId ? (subjMap.get(g.subjectId) ?? "—") : "—"}</div>
                    <div className="col-span-4">{g.termId ? (termMap.get(g.termId) ?? "—") : "—"}</div>
                  </div>
                )) ?? <div className="p-4 text-sm opacity-70">Sin grupos.</div>}
              </div>
            </div>
          </section>
        )}
      </div>
    );
  }

  /** ========================= OTROS ROLES ========================= */
  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Mi perfil</h1>
          <div className="text-sm opacity-70">{email} · Rol: {role || "—"}</div>
        </div>
        <a href="/logout" className="px-3 py-2 border rounded text-sm">Cerrar sesión</a>
      </div>

      <div className="border rounded p-4 text-sm">
        <p>Tu rol es <b>{role || "—"}</b>. Si eres parte del staff, entra a <a className="underline" href="/staff">/staff</a>.</p>
      </div>
    </div>
  );
}
