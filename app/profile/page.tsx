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
      .eq("userId", auth.user.id) // "userId" es TEXT; auth.user.id llega como string uuid -> OK
      .maybeSingle();

    const studentName =
      sp?.fullName ||
      [sp?.first_name, sp?.last_name].filter(Boolean).join(" ") ||
      email;

    // 2) Intento principal (canónico): Enrollment -> Group -> Sessions
    let groupIds: number[] = [];
    if (sp?.id != null) {
      const { data: enr, error } = await supabase
        .from("Enrollment")
        .select('"groupId"')
        .eq("studentId", sp.id);
      groupIds = Array.from(new Set((enr ?? []).map((r: any) => Number(r.groupId)).filter(Boolean)));
    }

    // 3) Catálogos
    let groups: any[] = [];
    let sessions: any[] = [];
    const subjectMap = new Map<number, string>();
    const termMap = new Map<number, string>();

    if (groupIds.length) {
      // ——— Camino canónico ———
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

    // 4) Fallback si no hay grupos (o están vacíos):
    //    Construir desde ASSISTANCE -> SESSION_IDs
    //    Esto cubre el caso que mencionas: hay asistencia real, pero no hay Enrollment.
    if (!groupIds.length || (!groups.length && !sessions.length)) {
      // a) asistencia por uuid moderno
      const attUuid = await supabase
        .from("attendance")
        .select("session_id, status, updated_at")
        .eq("student_user_id", auth.user.id);

      // b) asistencia por llaves legacy (uuid en texto + StudentProfile.id)
      const candIds: string[] = [auth.user.id];
      if (sp?.id != null) candIds.push(String(sp.id));

      const attLegacy = candIds.length
        ? await supabase
            .from("attendance")
            .select("session_id, status, updated_at")
            .in("student_id", candIds)
        : { data: [] as any[], error: null };

      // c) set de sesiones desde asistencia
      const attRows = [...(attUuid.data ?? []), ...(attLegacy.data ?? [])];
      const sessionIdSet = new Set<number>((attRows ?? []).map((r: any) => Number(r.session_id)).filter(Boolean));

      if (sessionIdSet.size) {
        const ids = Array.from(sessionIdSet);
        const { data: sRows2 } = await supabase
          .from("sessions")
          .select("id, session_date, start_planned, room_code, status, group_id, subjectId")
          .in("id", ids);
        sessions = sRows2 ?? [];

        // d) Derivar groups y catálogos desde las sesiones
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
          // Si las sesiones no tienen group_id, al menos resolvemos materias por subjectId
          const subjIds3 = Array.from(
            new Set((sessions ?? []).map((s: any) => s.subjectId).filter(Boolean))
          );
          if (subjIds3.length) {
            const { data: subs3 } = await supabase.from("Subject").select("id, name").in("id", subjIds3);
            (subs3 ?? []).forEach((s: any) => subjectMap.set(s.id, s.name ?? ""));
          }
        }
      }
    }

    // 5) Asistencia (para pintar el estado por sesión)
    const attUuid2 = await supabase
      .from("attendance")
      .select("session_id, status, updated_at")
      .eq("student_user_id", auth.user.id);

    const candIds2: string[] = [auth.user.id];
    if (sp?.id != null) candIds2.push(String(sp.id));

    const attLegacy2 = candIds2.length
      ? await supabase
          .from("attendance")
          .select("session_id, status, updated_at")
          .in("student_id", candIds2)
      : { data: [] as any[], error: null };

    const attRows2 = [...(attUuid2.data ?? []), ...(attLegacy2.data ?? [])];
    const attBySession = new Map<number, { status: string; updated_at: string | null }>();
    for (const r of attRows2) {
      if (!attBySession.has(r.session_id)) {
        attBySession.set(r.session_id, { status: r.status, updated_at: r.updated_at ?? null });
      }
    }

    // 6) Derivados para tabs
    const myClasses = (sessions ?? []).map((s: any) => ({
      id: s.id as number,
      date: s.session_date ?? null,
      time: hhmm(s.start_planned ?? null),
      room: s.room_code ?? null,
      status: s.status ?? null,
      groupId: s.group_id ?? null,
      subjectName: s.subjectId ? (subjectMap.get(s.subjectId) ?? null) : null,
      myStatus: attBySession.get(s.id)?.status ?? "—",
    }));

    // Construye entradas tipadas de sujeto desde grupos y sesiones (dedup luego con Map)
const subjectEntries: [number, { id: number; name: string }][] = [];

for (const g of groups ?? []) {
  const sid = Number(g?.subjectId);
  if (sid) subjectEntries.push([sid, { id: sid, name: subjectMap.get(sid) ?? "—" }]);
}
for (const s of sessions ?? []) {
  const sid = Number(s?.subjectId);
  if (sid) subjectEntries.push([sid, { id: sid, name: subjectMap.get(sid) ?? "—" }]);
}

// Deduplicar por subjectId conservando el último nombre resuelto
const mySubjects = Array.from(new Map(subjectEntries).values());

    const tabs = [
      { key: "resumen", label: "Resumen" },
      { key: "materias", label: "Mis materias" },
      { key: "clases", label: "Mis clases" },
      { key: "grupos", label: "Mis grupos" },
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

        {/* CONTENIDOS */}
        {tab === "resumen" && (
          <section className="space-y-3">
            <h2 className="text-lg font-medium">Mi asistencia</h2>
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
                      <span className="px-2 py-0.5 rounded text-white text-xs"
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
                      {c.myStatus !== "Justificado" && (
                        <a className="text-xs underline" href={`/justifications/new?sessionId=${c.id}`}>Justificar</a>
                      )}
                    </div>
                  </div>
                ))}
                {!myClasses.length && <div className="p-4 text-sm opacity-70">Sin sesiones o sin asistencia registrada.</div>}
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
                    <div className="col-span-2">{c.myStatus}</div>
                  </div>
                ))}
                {!myClasses.length && <div className="p-4 text-sm opacity-70">Sin clases.</div>}
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
                {groups.map((g: any) => (
                  <div key={g.id} className="grid grid-cols-12 border-t px-3 py-2 text-sm items-center">
                    <div className="col-span-4">{g.code ?? `#${g.id}`}</div>
                    <div className="col-span-4">{g.subjectId ? (subjectMap.get(g.subjectId) ?? "—") : "—"}</div>
                    <div className="col-span-4">{g.termId ? (termMap.get(g.termId) ?? "—") : "—"}</div>
                  </div>
                ))}
                {!groups.length && <div className="p-4 text-sm opacity-70">Sin grupos.</div>}
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

    // Mis grupos (vía Group.teacher_user_id)
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
