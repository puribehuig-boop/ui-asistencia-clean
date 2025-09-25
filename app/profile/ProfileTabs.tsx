// app/profile/ProfileTabs.tsx
"use client";

import Link from "next/link";
import { useState } from "react";

type ClassItem = {
  id: number; date: string | null; time: string | null; room: string | null;
  status: string | null; isManual: boolean; startedAt: string | null; endedAt: string | null;
  groupCode: string | null; subjectName: string | null; withinWindow: boolean;
};
export default function ProfileTabs({
  profile, classes, subjects, teacher, groups,
}: {
  profile: { email: string; role: string };
  classes: any[];
  subjects: any[];
  teacher: any | null;
  groups: { id:number; code:string|null; termName:string|null; subjectName:string|null }[];
}) {
  const [tab, setTab] = useState<"perfil"|"clases"|"materias"|"grupos">("perfil");
  
  async function post(path: string, payload: any) {
    await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    location.reload();
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Perfil</h1>

      <div className="flex gap-2 border-b">
        <button onClick={() => setTab("perfil")} className={"px-3 py-2 " + (tab==="perfil" ? "border-b-2 border-black" : "")}>Perfil</button>
        <button onClick={() => setTab("clases")} className={"px-3 py-2 " + (tab==="clases" ? "border-b-2 border-black" : "")}>Mis clases</button>
        <button onClick={() => setTab("materias")} className={"px-3 py-2 " + (tab==="materias" ? "border-b-2 border-black" : "")}>Mis materias</button>
        <button onClick={() => setTab("grupos")} className={"px-3 py-2 " + (tab==="materias" ? "border-b-2 border-black" : "")}>Mis grupos</button>
      </div>

      {tab === "perfil" && (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <div><b>Email:</b> {profile.email}</div>
          <div><b>Rol:</b> {profile.role}</div>
        </div>
        <a href="/logout" className="px-3 py-2 rounded border shadow-sm hover:bg-gray-50">Cerrar sesión</a>
      </div>

      {teacher && (
        <div className="border rounded p-4">
          <h3 className="font-medium mb-3">Datos del docente</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2 text-sm">
            <div><b>Nombre:</b> {[teacher.first_name, teacher.last_name].filter(Boolean).join(" ") || "—"}</div>
            <div><b>Edad:</b> {teacher.edad ?? "—"}</div>
            <div><b>CURP:</b> {teacher.curp ?? "—"}</div>
            <div><b>RFC:</b> {teacher.rfc ?? "—"}</div>
            <div><b>Dirección:</b> {teacher.direccion ?? "—"}</div>
            <div><b>Plantel:</b> {teacher.plantel ?? "—"}</div>
            <div><b>Licenciatura:</b> {teacher.licenciatura ?? "—"}</div>
            <div><b>Cédula Lic.:</b> {teacher.cedula_lic ?? "—"}</div>
            <div><b>Maestría:</b> {teacher.maestria ?? "—"}</div>
            <div><b>Cédula Maest.:</b> {teacher.cedula_maest ?? "—"}</div>
            <div><b>Doctorado:</b> {teacher.doctorado ?? "—"}</div>
            <div><b>Cédula Doct.:</b> {teacher.cedula_doct ?? "—"}</div>
            <div><b>Estado civil:</b> {teacher.estado_civil ?? "—"}</div>
            <div><b>Nacionalidad:</b> {teacher.nacionalidad ?? "—"}</div>
          </div>
        </div>
      )}
    </div>
  )}


      {tab === "clases" && (
        <div className="space-y-3">
          {!classes.length && <div className="opacity-70">No tienes clases en el rango reciente.</div>}
          {classes.map(c => (
            <div key={c.id} className="border rounded p-3 flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="text-sm opacity-70">
                  {c.date ? new Date(c.date).toLocaleDateString() : "—"} · {c.time ?? "—"} · {c.room ? `Salón ${c.room}` : "—"}
                </div>
                <div className="text-base">
                  {c.subjectName ? <b>{c.subjectName}</b> : <span>Materia —</span>}
                  {c.groupCode ? <span className="opacity-70"> · Grupo {c.groupCode}</span> : null}
                  <span className="opacity-70"> · Estado: <b>{c.status ?? "—"}</b></span>
                  {c.isManual ? <span className="ml-2 text-xs rounded border px-1">Manual</span> : null}
                  {c.withinWindow ? <span className="ml-2 text-xs rounded bg-green-600 text-white px-1">En ventana</span> : <span className="ml-2 text-xs rounded bg-gray-200 px-1">Fuera de ventana</span>}
                </div>
              </div>

              <div className="flex gap-2">
                {/* Acciones rápidas */}
                {!c.startedAt && (
                  <button
                    className="px-3 py-2 rounded border disabled:opacity-50"
                    disabled={!c.withinWindow}
                    onClick={() => post("/api/sessions/start", { session_id: c.id })}
                    title={c.isManual ? "" : "Disponible ±30 min"}
                  >
                    Iniciar
                  </button>
                )}
                {c.startedAt && !c.endedAt && (
                  <button
                    className="px-3 py-2 rounded border disabled:opacity-50"
                    disabled={!c.withinWindow}
                    onClick={() => post("/api/sessions/finish", { session_id: c.id })}
                    title={c.isManual ? "" : "Disponible ±30 min"}
                  >
                    Finalizar
                  </button>
                )}
                <Link href={`/teacher/sessions/${c.id}`} className="px-3 py-2 rounded border">Ir a clase</Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "materias" && (
        <div className="space-y-2">
          {!subjects.length && <div className="opacity-70">Aún no hay materias ligadas.</div>}
          {subjects.map((s, i) => (
            <div key={i} className="border rounded p-3">
              <div className="text-base"><b>{s.name}</b></div>
              {s.groupCode ? <div className="text-sm opacity-70">Grupo {s.groupCode}</div> : null}
            </div>
          ))}
        </div>
      )}
    </div>

    {tab === "grupos" && (
    <div className="space-y-2">
      {!groups.length && <div className="opacity-70">Aún no tienes grupos asignados.</div>}
      {groups.map(g => (
        <div key={g.id} className="border rounded p-3 flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="text-base"><b>{g.code ?? `Grupo #${g.id}`}</b></div>
            <div className="text-sm opacity-70">
              Materia: <b>{g.subjectName ?? "—"}</b> · Periodo: <b>{g.termName ?? "—"}</b>
            </div>
          </div>
          <a href={`/teacher/groups/${g.id}`} className="px-3 py-2 rounded border">Ver grupo</a>
        </div>
      ))}
    </div>
  )}
  );
}
