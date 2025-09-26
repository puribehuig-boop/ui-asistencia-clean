// app/staff/control-escolar/calificaciones/page.tsx
import { createSupabaseServerClient } from "@/lib/supabase/serverClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function StaffGradesPage() {
  const supabase = createSupabaseServerClient();

  // Placeholder: ejemplo de “últimas calificaciones modificadas”
  const { data: lastGrades } = await supabase
    .from("Enrollment")
    .select("id, \"groupId\", final_grade, updated_at")
    .not("final_grade", "is", null)
    .order("updated_at", { ascending: false })
    .limit(20);

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Calificaciones</h1>
      <div className="border rounded">
        <div className="grid grid-cols-12 bg-gray-50 px-3 py-2 text-sm font-medium">
          <div className="col-span-3 text-black">Enrollment</div>
          <div className="col-span-3 text-black">Grupo</div>
          <div className="col-span-3 text-black">Calificación</div>
          <div className="col-span-3 text-black">Actualizada</div>
        </div>
        <div>
          {(lastGrades ?? []).map((r) => (
            <div key={r.id} className="grid grid-cols-12 border-t px-3 py-2 text-sm">
              <div className="col-span-3">#{r.id}</div>
              <div className="col-span-3">{r["groupId"] ?? "—"}</div>
              <div className="col-span-3">{r.final_grade ?? "—"}</div>
              <div className="col-span-3">{r.updated_at ? new Date(r.updated_at).toLocaleString() : "—"}</div>
            </div>
          ))}
          {(!lastGrades || !lastGrades.length) && (
            <div className="p-4 text-sm opacity-70">Sin calificaciones aún.</div>
          )}
        </div>
      </div>
    </div>
  );
}
