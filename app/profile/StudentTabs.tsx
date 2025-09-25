// app/profile/StudentTabs.tsx
"use client";

import { useEffect, useMemo, useState } from "react";

type MyGroup = {
  id: number;
  code: string | null;
  subjectName: string | null;
  termName: string | null;
};

type MyClass = {
  id: number;
  date: string | null;       // YYYY-MM-DD
  time: string | null;       // HH:mm (o null)
  room: string | null;
  status: string | null;     // estado de la sesión (started/finished/etc.)
  myStatus: string;          // Presente / Tarde / Ausente / Justificado / —
  groupId: number | null;
  subjectName: string | null;
};

type MyGrade = { groupId: number; subjectName: string | null; final: number | null };

export default function StudentTabs({
  profile, groups, classes, grades,
}: {
  profile: { email: string; role: string };
  groups: MyGroup[];
  classes: MyClass[];
  grades: MyGrade[];
}) {
  const [tab, setTab] = useState<"perfil"|"horario"|"asistencia"|"calificaciones"|"materias">("perfil");

  // ========= Helpers para el Dashboard =========
  function toDateTime(d: string | null, t: string | null): Date | null {
    if (!d) return null;
    // Si no hay hora, tomamos 00:00
    const hhmm = t && /^\d{2}:\d{2}$/.test(t) ? t : "00:00";
    const isoLike = `${d}T${hhmm}:00`;
    const dt = new Date(isoLike);
    return isNaN(dt.getTime()) ? null : dt;
  }

  const now = new Date();

  const upcoming = useMemo<{ c: MyClass; start: Date | null } | null>(() => {
  const future = classes
    .map(c => ({ c, start: toDateTime(c.date, c.time) }))
    .filter(x => x.start && x.start.getTime() > now.getTime())
    .sort((a, b) => (a.start!.getTime() - b.start!.getTime()));
  return future.length ? future[0] : null;
}, [classes]);

  const counts = useMemo(() => {
    const acc = { Presente: 0, Tarde: 0, Ausente: 0, Justificado: 0, Total: 0 };
    for (const c of classes) {
      const st = (c.myStatus || "—").trim();
      if (st === "Presente") acc.Presente++;
      else if (st === "Tarde") acc.Tarde++;
      else if (st === "Ausente") acc.Ausente++;
      else if (st === "Justificado") acc.Justificado++;
      acc.Total++;
    }
    return acc;
  }, [classes]);

  const attendancePct = useMemo(() => {
    if (!counts.Total) return 0;
    return Math.round((counts.Presente / counts.Total) * 100);
  }, [counts]);

  // Cuenta regresiva a la próxima clase (si existe y tiene hora)
 const [countdown, setCountdown] = useState<string>("");

useEffect(() => {
  const start = upcoming?.start ?? null;
  if (!start) { setCountdown(""); return; }

  const tick = () => {
    const diff = start.getTime() - Date.now();
    if (diff <= 0) { setCountdown("¡ya!"); return; }
    const h = Math.floor(diff / 3_600_000);
    const m = Math.floor((diff % 3_600_000) / 60_000);
    const s = Math.floor((diff % 60_000) / 1000);
    setCountdown(`${h.toString().padStart(2,"0")}:${m.toString().padStart(2,"0")}:${s.toString().padStart(2,"0")}`);
  };

  tick();
  const id = setInterval(tick, 1000);
  return () => clearInterval(id);
}, [upcoming?.start?.getTime()]);

  // ========= UI =========
  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Mi perfil</h1>

      <div className="flex gap-2 border-b">
        <button onClick={() => setTab("perfil")} className={"px-3 py-2 " + (tab==="perfil" ? "border-b-2 border-black" : "")}>Inicio</button>
        <button onClick={() => setTab("horario")} className={"px-3 py-2 " + (tab==="horario" ? "border-b-2 border-black" : "")}>Mi horario</button>
        <button onClick={() => setTab("asistencia")} className={"px-3 py-2 " + (tab==="asistencia" ? "border-b-2 border-black" : "")}>Mi asistencia</button>
        <button onClick={() => setTab("calificaciones")} className={"px-3 py-2 " + (tab==="calificaciones" ? "border-b-2 border-black" : "")}>Mis calificaciones</button>
        <button onClick={() => setTab("materias")} className={"px-3 py-2 " + (tab==="materias" ? "border-b-2 border-black" : "")}>Mis materias</button>
      </div>

      {tab === "perfil" && (
        <div className="space-y-6">
          {/* Header simple con datos y logout */}
          <div className="flex items-start justify-between">
            <div>
              <div><b>Email:</b> {profile.email}</div>
              <div><b>Rol:</b> {profile.role}</div>
            </div>
            <a href="/logout" className="px-3 py-2 rounded border shadow-sm hover:bg-gray-50">Cerrar sesión</a>
          </div>

          {/* DASHBOARD */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Próxima clase */}
            <div className="border rounded p-4 lg:col-span-2">
              <h3 className="font-medium mb-2">Próxima clase</h3>
              {!upcoming ? (
                <div className="text-sm opacity-70">Sin clases próximas.</div>
              ) : (
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="space-y-1">
                    <div className="text-base">
                      <b>{upcoming.c.subjectName ?? "Materia —"}</b>
                      {upcoming.c.room ? <span className="opacity-70"> · Salón {upcoming.c.room}</span> : null}
                    </div>
                    <div className="text-sm opacity-70">
                      {upcoming.c.date ? new Date(upcoming.c.date).toLocaleDateString() : "—"}
                      {upcoming.c.time ? ` · ${upcoming.c.time}` : ""}
                    </div>
                  </div>
                  <div className="text-center">
                    {upcoming.start && countdown ? (
                      <>
                        <div className="text-xs opacity-60">Comienza en</div>
                        <div className="text-2xl font-semibold tabular-nums">{countdown}</div>
                      </>
                    ) : (
                      <div className="text-sm opacity-70">Sin hora definida</div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Resumen de asistencia */}
            <div className="border rounded p-4">
              <h3 className="font-medium mb-2">Mi asistencia</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="border rounded p-2 flex items-center justify-between">
                  <span>Presente</span><b>{counts.Presente}</b>
                </div>
                <div className="border rounded p-2 flex items-center justify-between">
                  <span>Tarde</span><b>{counts.Tarde}</b>
                </div>
                <div className="border rounded p-2 flex items-center justify-between">
                  <span>Ausente</span><b>{counts.Ausente}</b>
                </div>
                <div className="border rounded p-2 flex items-center justify-between">
                  <span>Justificado</span><b>{counts.Justificado}</b>
                </div>
              </div>
              <div className="mt-3 text-sm">
                Total: <b>{counts.Total}</b> · Asistencia: <b>{attendancePct}%</b>
              </div>
            </div>
          </div>

                   {/* Accesos rápidos */}
          <div className="border rounded p-4">
            <h3 className="font-medium mb-2">Accesos rápidos</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="border rounded p-3">
                <div className="text-sm font-medium">Buzón anónimo</div>
                <div className="text-xs opacity-60">Próximamente</div>
              </div>
              <div className="border rounded p-3">
                <div className="text-sm font-medium">Mis trámites</div>
                <div className="text-xs opacity-60">Próximamente</div>
              </div>
            </div>
          </div>
      )}

      {tab === "horario" && (
        <div className="space-y-2">
          {!classes.length && <div className="opacity-70">Aún no tienes sesiones asignadas.</div>}
          {classes.map(c => (
            <div key={c.id} className="border rounded p-3 flex flex-wrap items-center justify-between">
              <div className="space-y-0.5">
                <div className="text-sm opacity-70">
                  {c.date ? new Date(c.date).toLocaleDateString() : "—"} · {c.time ?? "—"} · {c.room ? `Salón ${c.room}` : "—"}
                </div>
                <div className="text-base">
                  {c.subjectName ? <b>{c.subjectName}</b> : <span>Materia —</span>}
                  <span className="opacity-70"> · Estado sesión: <b>{c.status ?? "—"}</b></span>
                </div>
              </div>
              <div className="text-sm">
                Mi asistencia: <b>{c.myStatus}</b>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "asistencia" && (
        <div className="space-y-2">
          {!classes.length && <div className="opacity-70">Sin registros de asistencia.</div>}
          {classes.map(c => (
            <div key={c.id} className="border rounded p-3 flex flex-wrap items-center justify-between">
              <div>{c.subjectName ?? "Materia —"} — {c.date ? new Date(c.date).toLocaleDateString() : "—"} {c.time ? `· ${c.time}` : ""}</div>
              <div className="text-sm">Mi asistencia: <b>{c.myStatus}</b></div>
            </div>
          ))}
        </div>
      )}

      {tab === "calificaciones" && (
        <div className="space-y-2">
          {!grades.length && <div className="opacity-70">Aún no hay calificaciones finales.</div>}
          {grades.map((g, i) => (
            <div key={i} className="border rounded p-3 flex items-center justify-between">
              <div>{g.subjectName ?? "Materia —"}</div>
              <div><b>{g.final ?? "—"}</b></div>
            </div>
          ))}
        </div>
      )}

      {tab === "materias" && (
        <div className="space-y-2">
          {!groups.length && <div className="opacity-70">Aún no estás inscrito en materias.</div>}
          {groups.map(g => (
            <div key={g.id} className="border rounded p-3">
              <div className="text-base"><b>{g.subjectName ?? "Materia —"}</b></div>
              <div className="text-sm opacity-70">
                {g.code ? `Grupo ${g.code}` : `Grupo #${g.id}`} · Periodo: <b>{g.termName ?? "—"}</b>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
