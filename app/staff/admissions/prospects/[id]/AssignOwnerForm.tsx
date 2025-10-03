"use client";

import { useRouter } from "next/navigation";

export default function AssignOwnerForm({
  prospectId,
  currentOwner,
  staff,
  meId,
}: {
  prospectId: number;
  currentOwner: string | null;
  staff: Array<{ user_id: string; email: string }>;
  meId: string;
}) {
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const sel = form.querySelector('select[name="owner"]') as HTMLSelectElement;
    const val = sel.value;

    const mode =
      val === "__me__" ? "take" : val === "__none__" ? "unassign" : "assign";
    const payload: any = { mode };
    if (mode === "assign") payload.owner_user_id = val;

    const res = await fetch(
      `/api/staff/admissions/prospects/${prospectId}/assign`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );

    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j?.error ?? "Error asignando");
      return;
    }

    router.refresh(); // refresca SSR sin recargar toda la página
  }

  return (
    <form
      className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm"
      onSubmit={handleSubmit}
    >
      <div>
        <div className="opacity-60 text-xs">Asignar a</div>
        <select name="owner" className="w-full border rounded px-2 py-1" defaultValue="">
          <option value="">— seleccionar —</option>
          {!currentOwner && <option value="__me__">Tomar yo</option>}
          {currentOwner && currentOwner !== meId && (
            <option value="__me__">Reasignar a mí</option>
          )}
          <option value="__none__">Liberar (sin asignar)</option>
          <optgroup label="Asesores">
            {(staff ?? []).map((s) => (
              <option key={s.user_id} value={s.user_id}>
                {s.email} {s.user_id === currentOwner ? " (actual)" : ""}
              </option>
            ))}
          </optgroup>
        </select>
      </div>
      <div className="flex items-end">
        <button className="px-3 py-1 border rounded">Guardar asignación</button>
      </div>
    </form>
  );
}
