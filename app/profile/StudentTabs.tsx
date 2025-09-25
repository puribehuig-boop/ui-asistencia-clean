// app/profile/StudentTabs.tsx
"use client";

import { useState } from "react";

type MyGroup = { id: number; code: string | null; subjectName: string | null; termName: string | null };
type MyClass = { id: number; date: string | null; time: string | null; room: string | null; status: string | null; myStatus: string; groupId: number; subjectName: string | null };
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

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Mi perfil</h1>

      <div className="flex gap-2 border-b">
        <button onClick={() => setTab("perfil")} className={"px-3 py-2 " + (tab==="perfil" ? "border-b-2 border-black" : "")}>Perfil</button>
        <button onClick={() => setTab("horario")} className={"px-3 py-2 " + (tab==="horario" ? "border-b-2 border-black" : "")}>Mi horario</button>
        <button onClick={() => setTab("asistencia")} className={"px-3 py-2 " + (tab==="asistencia" ? "border-b-2 border-black" : "")}>Mi asistencia</button>
        <button onClick={() => setTab("calificaciones")} className={"px-3 py-2 " + (tab==="calificaciones" ? "border-b-2 border-black" : "")}>Mis calificaciones</button>
        <button onClick={() => setTab("materias")} className={"px-3 py-2 " + (tab==="materias" ? "border-b-2 border-black" : "")}>Mis materias</button>
      </div>

      {tab === "perfil" && (
        <div className="flex items-start justify-between">
          <div>
            <div><b>Email:</b> {profile.email}</div>
            <div><b>Rol:</b> {profile.role}</div>
          </div>
          <a href="/logout" className="px-3 py-2 rounded border shadow-sm hover:bg-gray-50">Cerrar sesión</a>
        </div>
      )}

      {tab === "horario" && (
        <div className="space-y-2">
          {!classes.length && <div className="opacity-70">Aún no tienes sesiones asignadas.</div>}
          {classes.map(c => (
            <div key={c.id} className="border rounded p-3 flex flex-wrap items-center justify-between">
              <div className="space-y-0.5">
                <div className="text-sm opacity-70">{c.date ? new Date(c.date).toLocaleDateString() : "—"} · {c.time ?? "—"} · {c.room ? `Salón ${c.room}` : "—"}</div>
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
              <div className="text-sm opacity-70">{g.code ? `Grupo ${g.code}` : `Grupo #${g.id}`} · Periodo: <b>{g.termName ?? "—"}</b></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
