"use client";
import { useRouter } from "next/navigation";

const STAGES = [
  "nuevo","contactado","interesado","en_proceso","aceptado","inscrito","descartado"
] as const;

export default function StageSelect({ prospectId, current }: { prospectId: number; current: string }) {
  const router = useRouter();

  async function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const stage = e.target.value;
    if (!STAGES.includes(stage as any)) return;
    const res = await fetch("/api/staff/admissions/prospects/move", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: prospectId, stage }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j?.error ?? "Error al cambiar etapa");
      return;
    }
    router.refresh();
  }

  return (
    <select defaultValue={current} onChange={onChange} className="border rounded px-2 py-1">
      {STAGES.map(s => <option key={s} value={s}>{s.replace("_"," ")}</option>)}
    </select>
  );
}
