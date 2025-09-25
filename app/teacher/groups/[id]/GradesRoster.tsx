"use client";
import { useEffect, useState } from "react";
import supabase from "@/lib/supabase/browserClient";

type Row = {
  enrollment_id: number;
  student_id_text: string;
  student_name: string;
  final_grade: number | null;
};

export default function GradesRoster({ groupId }: { groupId: number }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [saving, setSaving] = useState<number | null>(null);
  const [err, setErr] = useState<string>("");

  async function load() {
    setErr("");
    const { data, error } = await supabase
      .from("v_group_roster")
      .select("enrollment_id, student_id_text, student_name, final_grade")
      .eq("group_id", groupId)
      .order("student_name", { ascending: true });
    if (error) { setErr(error.message); return; }
    setRows((data ?? []) as any);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [groupId]);

  async function save(enrollment_id: number, final_grade: number | "") {
    const val = final_grade === "" ? null : Number(final_grade);
    if (val !== null && (isNaN(val) || val < 0 || val > 100)) {
      alert("La calificación debe ser un número entre 0 y 100.");
      return;
    }
    try {
      setSaving(enrollment_id);
      const { error } = await supabase
        .from("Enrollment")
        .update({ final_grade: val })
        .eq("id", enrollment_id);
      if (error) throw error;
      await load();
    } catch (e: any) {
      alert(e.message || String(e));
    } finally {
      setSaving(null);
    }
  }

  if (err) return <div className="p-4 text-red-600">Error: {err}</div>;

  return (
    <div className="border rounded">
      <div className="grid grid-cols-12 bg-gray-50 px-3 py-2 text-sm font-medium">
        <div className="col-span-7 text-black">Alumno</div>
        <div className="col-span-3 text-black">Calificación final</div>
        <div className="col-span-2 text-black">Acciones</div>
      </div>
      <div>
        {rows.map((r) => (
          <div key={r.enrollment_id} className="grid grid-cols-12 items-center border-t px-3 py-2 text-sm">
            <div className="col-span-7 break-words">{r.student_name}</div>
            <div className="col-span-3">
              <input
                type="number"
                min={0}
                max={100}
                step="0.01"
                defaultValue={r.final_grade ?? ""}
                className="w-28 px-2 py-1 border rounded"
                onChange={(e) => (r.final_grade = e.target.value === "" ? null : Number(e.target.value))}
              />
            </div>
            <div className="col-span-2">
              <button
                className="px-2 py-1 border rounded text-xs"
                disabled={saving === r.enrollment_id}
                onClick={() => save(r.enrollment_id, r.final_grade as any)}
              >
                {saving === r.enrollment_id ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        ))}
        {!rows.length && <div className="p-4 text-sm opacity-70">Sin alumnos en este grupo.</div>}
      </div>
    </div>
  );
}
