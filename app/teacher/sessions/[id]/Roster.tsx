// app/teacher/sessions/[id]/Roster.tsx
"use client";
import { useEffect, useMemo, useState } from "react";
// Ajusta este import a tu browser client real:
import { browserClient as supabase } from "@/lib/supabase/browserClient";
// Si no tienes "browserClient", expórtalo como "supabase" y cambia la línea de arriba.

type Row = {
  student_id: string;
  student_name: string;
  status: "Presente" | "Tarde" | "Ausente" | "Justificado" | null;
  updated_at?: string | null;
};

export default function Roster({
  sessionId,
  groupId,
}: {
  sessionId: number;
  groupId: number | null;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string>("");

  async function load() {
  setLoading(true);
  setErr("");
  try {
    // 1) PRIMERO: intenta leer attendance existente de la sesión (más directo)
    const attRes = await supabase
      .from("attendance")
      .select("student_id, student_name, status, updated_at")
      .eq("session_id", sessionId);

    if (!attRes.error && Array.isArray(attRes.data) && attRes.data.length > 0) {
      setRows(
        attRes.data.map((a: any) => ({
          student_id: String(a.student_id),
          student_name: a.student_name || "—",
          status: a.status ?? null,
          updated_at: a.updated_at ?? null,
        }))
      );
      setLoading(false);
      return;
    }

    // 2) Si no hay attendance (o no se puede leer), intenta la vista v_session_roster
    const vrowsRes = await supabase
      .from("v_session_roster")
      .select("student_id, student_name, status, updated_at")
      .eq("session_id", sessionId);

    if (!vrowsRes.error && Array.isArray(vrowsRes.data) && vrowsRes.data.length > 0) {
      setRows(
        vrowsRes.data.map((r: any) => ({
          student_id: String(r.student_id),
          student_name: r.student_name || "—",
          status: r.status ?? null,
          updated_at: r.updated_at ?? null,
        }))
      );
      setLoading(false);
      return;
    }

    // 3) Último fallback: Enrollment → profiles (sólo si hay groupId)
    if (!groupId) {
      setRows([]);
      setLoading(false);
      return;
    }

    // Enrollment: intenta student_user_id, luego student_id
    let studentIds: string[] = [];
    const e1 = await supabase.from("Enrollment").select("student_user_id").eq("group_id", groupId);
    if (!e1.error && Array.isArray(e1.data) && e1.data.length > 0) {
      studentIds = e1.data.map((r: any) => String(r.student_user_id));
    } else {
      const e2 = await supabase.from("Enrollment").select("student_id").eq("group_id", groupId);
      if (!e2.error && Array.isArray(e2.data)) {
        studentIds = e2.data.map((r: any) => String(r.student_id));
      }
    }

    const profs = await supabase
      .from("profiles")
      .select("user_id, email")
      .in("user_id", studentIds);

    const byId: Record<string, string> = {};
    if (!profs.error && Array.isArray(profs.data)) {
      profs.data.forEach((p: any) => (byId[String(p.user_id)] = p.email));
    }

    setRows(
      studentIds.map((id) => ({
        student_id: id,
        student_name: byId[id] || "—",
        status: null,
        updated_at: null,
      }))
    );
  } catch (e: any) {
    setErr(e.message || String(e));
  } finally {
    setLoading(false);
  }
}


  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, groupId]);

  async function setStatus(student_id: string, student_name: string, status: Row["status"]) {
    try {
      const res = await fetch("/api/attendance/set", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          student_id,
          student_name,
          status,
        }),
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error || "error");
      await load();
    } catch (e: any) {
      alert(e.message || String(e));
    }
  }

  if (loading) return <div className="p-4">Cargando alumnos…</div>;
  if (err) return <div className="p-4 text-red-600">Error: {err}</div>;

  return (
    <div className="border rounded">
      <div className="grid grid-cols-12 bg-gray-50 px-3 py-2 text-sm font-medium">
        <div className="col-span-6">Alumno</div>
        <div className="col-span-3">Estado</div>
        <div className="col-span-3">Acciones</div>
      </div>
      <div>
        {rows.map((r) => (
          <div key={r.student_id} className="grid grid-cols-12 items-center border-t px-3 py-2 text-sm">
            <div className="col-span-6 break-words">{r.student_name}</div>
            <div className="col-span-3">{r.status ?? "—"}</div>
            <div className="col-span-3 flex gap-1 flex-wrap">
              {["Presente", "Tarde", "Ausente", "Justificado"].map((st) => (
                <button
                  key={st}
                  onClick={() => setStatus(r.student_id, r.student_name, st as any)}
                  className="px-2 py-1 border rounded text-xs"
                >
                  {st}
                </button>
              ))}
            </div>
          </div>
        ))}
        {!rows.length && <div className="p-4 text-sm opacity-70">Sin alumnos ligados a esta sesión.</div>}
      </div>
    </div>
  );
}
