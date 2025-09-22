"use client";
import { useEffect, useState } from "react";

type Subject = { id:number; code:string; name:string };
type Item = { programId:number; subjectId:number; term:number; subject: Subject };

export default function AssignPage({ params }: { params: { id: string } }) {
  const programId = Number(params.id);

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [subjectId, setSubjectId] = useState<number | "">("");
  const [term, setTerm] = useState<number | "">("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setErr(null);
    try {
      const [rs, ri] = await Promise.all([
        fetch("/api/admin/subjects", { cache: "no-store" }),
        fetch(`/api/admin/program-subjects?programId=${programId}`, { cache: "no-store" }),
      ]);
      const js = await rs.json(), ji = await ri.json();
      if (!js.ok) throw new Error(js.error);
      if (!ji.ok) throw new Error(ji.error);
      setSubjects(js.subjects ?? []);
      setItems(ji.items ?? []);
    } catch (e:any) { setErr(e.message || String(e)); }
  }
  useEffect(() => { load(); }, [programId]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!subjectId || !term) return;
    const subj = subjects.find(s => s.id === Number(subjectId));
    const msg = `Vas a asignar "${subj?.name ?? subjectId}" al término ${term}. ¿Continuar?`;
    if (!confirm(msg)) return;

    setLoading(true); setErr(null);
    try {
      const r = await fetch("/api/admin/program-subjects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ programId, subjectId: Number(subjectId), term: Number(term) }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error);
      setSubjectId(""); setTerm("");
      await load();
    } catch (e:any) { setErr(e.message || String(e)); }
    finally { setLoading(false); }
  }

  async function remove(it: Item) {
    const subj = subjects.find(s => s.id === it.subjectId);
    if (!confirm(`¿Quitar "${subj?.name ?? it.subjectId}" del término ${it.term}?`)) return;

    setLoading(true); setErr(null);
    try {
      const r = await fetch("/api/admin/program-subjects", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ programId: it.programId, subjectId: it.subjectId, term: it.term }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error);
      await load();
    } catch (e:any) { setErr(e.message || String(e)); }
    finally { setLoading(false); }
  }

  return (
    <div className="max-w-3xl">
      <h2 className="text-lg font-semibold mb-3">Asignar materias — Programa #{programId}</h2>

      <form onSubmit={add} className="flex flex-wrap gap-2 mb-4">
        <select className="border rounded px-2 py-1 text-black"
                value={subjectId as any}
                onChange={e => setSubjectId(e.target.value ? Number(e.target.value) : "")}>
          <option value="">Selecciona materia</option>
          {subjects.map(s => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
        </select>

        <input className="border rounded px-2 py-1 text-black"
               type="number" min={1} max={20}
               value={term as any}
               onChange={e => setTerm(e.target.value ? Number(e.target.value) : "")}
               placeholder="Término (ej. 1)"/>

        <button className="border rounded px-3 py-1" disabled={loading}>Agregar</button>
      </form>

      {err && <p className="text-red-600 mb-2">Error: {err}</p>}

      <table className="w-full text-sm">
        <thead className="text-left opacity-70 border-b">
          <tr>
            <th className="py-2">Término</th>
            <th>Materia</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {items.map(it => (
            <tr key={`${it.programId}-${it.subjectId}-${it.term}`} className="border-b">
              <td className="py-2">{it.term}</td>
              <td>{it.subject?.code} — {it.subject?.name}</td>
              <td>
                <button className="text-red-600" onClick={() => remove(it)} disabled={loading}>
                  Quitar
                </button>
              </td>
            </tr>
          ))}
          {items.length === 0 &&
            <tr><td colSpan={3} className="py-3 text-neutral-500">Sin asignaciones.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
