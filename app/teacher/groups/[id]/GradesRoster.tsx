// app/teacher/groups/[id]/GradesRoster.tsx
"use client";
import { useEffect, useState } from "react";
import supabase from "@/lib/supabase/browserClient";

type Row = {
  enrollment_id: number;
  student_id_text: string;
  student_name: string;
  final_grade: number | null;
};

function fmtGrade(v: number | null) {
  if (v === null || v === undefined) return "—";
  // Muestra enteros sin decimales y decimales con hasta 2
  return Number.isInteger(v) ? String(v) : v.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export default function GradesRoster({ groupId }: { groupId: number }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [err, setErr] = useState<string>("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<string>("");
  const [saving, setSaving] = useState<boolean>(false);

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

  function startEdit(r: Row) {
    setEditingId(r.enrollment_id);
    setDraft(r.final_grade === null || r.final_grade === undefined ? "" : String(r.final_grade));
  }
  function cancelEdit() {
    setEditingId(null);
    setDraft("");
  }

  async function save() {
    if (editingId == null) return;
    const val = draft.trim() === "" ? null : Number(draft);
    if (val !== null && (isNaN(val) || val < 0 || val > 100)) {
      alert("La calificación debe ser un número entre 0 y 100.");
      return;
    }
    try {
      setSaving(true);
      const { error } = await supabase
        .from("Enrollment")
        .update({ final_grade: val })
        .eq("id", editingId);
      if (error) throw error;
      await load();
      cancelEdit();
    } catch (e: any) {
      alert(e.message || String(e));
    } finally {
      setSaving(false);
    }
  }

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") { e.preventDefault(); void save(); }
    if (e.key === "Escape") { e.preventDefault(); cancelEdit(); }
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
        {rows.map((r) => {
          const isEditing = editingId === r.enrollment_id;
          return (
            <div key={r.enrollment_id} className="grid grid-cols-12 items-center border-t px-3 py-2 text-sm">
              <div className="col-span-7 break-words">{r.student_name}</div>

              <div className="col-span-3">
                {!isEditing ? (
                  <span className="font-medium">{fmtGrade(r.final_grade)}</span>
                ) : (
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step="0.01"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={onKey}
                    className="w-28 px-2 py-1 border rounded"
                    autoFocus
                  />
                )}
              </div>

              <div className="col-span-2 flex gap-2">
                {!isEditing ? (
                  <button
                    className="px-2 py-1 border rounded text-xs"
                    onClick={() => startEdit(r)}
                  >
                    Editar
                  </button>
                ) : (
                  <>
                    <button
                      className="px-2 py-1 border rounded text-xs"
                      onClick={save}
                      disabled={saving}
                    >
                      {saving ? "Guardando…" : "Guardar"}
                    </button>
                    <button
                      className="px-2 py-1 border rounded text-xs"
                      onClick={cancelEdit}
                      disabled={saving}
                    >
                      Cancelar
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}

        {!rows.length && (
          <div className="p-4 text-sm opacity-70">Sin alumnos en este grupo.</div>
        )}
      </div>
    </div>
  );
}
