"use client";

import { useEffect, useState } from "react";

type Program = { id: number; name: string; createdAt: string };

export default function ProgramsPage() {
  const [items, setItems] = useState<Program[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // 🔸 Estado para edición
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");

  async function load() {
    setErr(null);
    try {
      const r = await fetch("/api/admin/programs", { cache: "no-store" });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error);
      setItems(j.programs ?? []);
    } catch (e: any) {
      setErr(e.message || String(e));
    }
  }

  useEffect(() => { load(); }, []);

  async function createProgram(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    if (!confirm(`Estás a punto de agregar el programa "${name}". ¿Continuar?`)) return;

    setLoading(true);
    setErr(null);
    try {
      const r = await fetch("/api/admin/programs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error);
      setName("");
      await load();
    } catch (e: any) {
      setErr(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  async function remove(id: number) {
    if (!confirm(`¿Borrar programa #${id}?`)) return;
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch(`/api/admin/programs/${id}`, { method: "DELETE" });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error);
      await load();
    } catch (e: any) {
      setErr(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  // 🔸 Entrar en modo edición
  function startEdit(p: Program) {
    setEditId(p.id);
    setEditName(p.name);
  }

  // 🔸 Cancelar edición
  function cancelEdit() {
    setEditId(null);
    setEditName("");
  }

  // 🔸 Guardar edición (PUT)
  async function saveEdit(id: number) {
    const next = editName.trim();
    if (!next) return;
    if (!confirm(`Vas a actualizar el programa #${id} a "${next}". ¿Continuar?`)) return;

    setLoading(true);
    setErr(null);
    try {
      const r = await fetch(`/api/admin/programs/${id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: next }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error);
      setEditId(null);
      setEditName("");
      await load();
    } catch (e: any) {
      setErr(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h2 className="text-lg font-semibold mb-3">Programas</h2>

      <form onSubmit={createProgram} className="flex gap-2 mb-4">
        <input
          className="border rounded px-2 py-1 flex-1 text-black"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nombre del programa"
        />
        <button className="border rounded px-3 py-1" disabled={loading}>Guardar</button>
      </form>

      {err && <p className="text-red-600">Error: {err}</p>}

      <table className="w-full text-sm">
        <thead className="text-left opacity-70 border-b">
          <tr>
            <th className="py-2">ID</th>
            <th>Nombre</th>
            <th>Creado</th>
            <th className="w-[220px]" />
          </tr>
        </thead>
        <tbody>
          {items.map((p) => (
            <tr key={p.id} className="border-b">
              <td className="py-2">{p.id}</td>

              <td>
                {editId === p.id ? (
                  <input
                    className="border rounded px-2 py-1 text-black w-full"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    autoFocus
                  />
                ) : (
                  p.name
                )}
              </td>

              <td>{new Date(p.createdAt).toLocaleString()}</td>

              <td className="flex gap-2 py-2">
                {editId === p.id ? (
                  <>
                    <button
                      className="border rounded px-2 py-1"
                      onClick={() => saveEdit(p.id)}
                      disabled={loading}
                      type="button"
                    >
                      Guardar
                    </button>
                    <button
                      className="border rounded px-2 py-1"
                      onClick={cancelEdit}
                      type="button"
                    >
                      Cancelar
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      className="border rounded px-2 py-1"
                      onClick={() => startEdit(p)}
                      type="button"
                    >
                      Editar
                    </button>
                    <button
                      className="text-red-600"
                      onClick={() => remove(p.id)}
                      disabled={loading}
                      type="button"
                    >
                      Borrar
                    </button>
                      <a className="underline underline-offset-2"
                       href={`/admin/programs/${p.id}/asignar`}>Asignar materias</a>
                  </>
                )}
              </td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td className="py-3 text-neutral-500" colSpan={4}>Sin registros.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
