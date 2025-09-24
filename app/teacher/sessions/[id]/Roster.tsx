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
      // 1) Intentar vista v_session_roster
      let useFallback = false;
      const { data: vrows, error: verr } = await supabase
        .from("v_session_roster")
        .select("student_id, student_name, status, updated_at")
        .eq("session_id", sessionId);

      if (verr) {
        useFallback = true;
      } else if (Array.isArray(vrows)) {
        setRows(
          vrows.map((r: any) => ({
            student_id: String(r.student_id),
            student_name: r.student_name || "—",
            status: (r.status as any) ?? null,
            updated_at: r.updated_at ?? null,
          }))
        );
      } else {
        useFallback = true;
      }

      // 2) Fallback: Enrollment + profiles + attendance
      if (useFallback) {
        if (!groupId) {
          // 3) Último fallback: solo attendance existentes
          const { data: att } = await supabase
            .from("attendance")
            .select("student_id, student_name, status, updated_at")
            .eq("session_id", sessionId);
          setRows(
            (att ?? []).map((a: any) => ({
              student_id: String(a.student_id),
              student_name: a.student_name || "—",
              status: a.status ?? null,
              updated_at: a.updated_at ?? null,
            }))
          );
          return;
        }

        // Leer enrollment (intentamos first student_user_id, luego student_id)
        let studentIds: string[] = [];
        let e1 = await supabase
          .from("Enrollment")
          .select("student_user_id")
          .eq("group_id", groupId);
        if (e1.error || !Array.isArray(e1.data)) {
          const e2 = await supabase
            .from("Enrollment")
            .select("student_id")
            .eq("group_id", groupId);
          if (e2.error) throw e2.error;
          studentIds = e2.data.map((r: any) => String(r.student_id));
        } else {
          studentIds = e1.data.map((r: any) => String(r.student_user_id));
        }

        // Jalar nombres desde profiles (ajusta si usas StudentProfile con display_name)
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, email")
          .in("user_id", studentIds);

        const byId: Record<string, { name: string }> = {};
        (profs ?? []).forEach((p: any) => {
          byId[String(p.user_id)] = { name: p.email };
        });

        const { data: att } = await supabase
          .from("attendance")
          .select("student_id, status, updated_at, student_name")
          .eq("session_id", sessionId);

        const byAtt: Record<string, { status: any; updated_at: string | null; student_name?: string | null }> = {};
        (att ?? []).forEach((a: any) => {
          byAtt[String(a.student_id)] = { status: a.status, updated_at: a.updated_at, student_name: a.student_name };
        });

        const merged = studentIds.map((id) => {
          const baseName = byId[id]?.name || "—";
          const a = byAtt[id];
          return {
            student_id: id,
            student_name: a?.student_name || baseName,
            status: (a?.status as any) ?? null,
            updated_at: a?.updated_at ?? null,
          } as Row;
        });

        setRows(merged);
      }
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
