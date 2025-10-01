// app/staff/control-escolar/justificaciones/page.tsx
import { supabaseAdmin } from "@/lib/supabase/adminClient";
import { createSupabaseServerClient } from "@/lib/supabase/serverClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function hhmm(t?: string | null) {
  if (!t) return "—";
  if (/^\d{4}$/.test(t)) return `${t.slice(0,2)}:${t.slice(2,4)}`;
  if (/^\d{2}:\d{2}/.test(t)) return t.slice(0,5);
  return t;
}

export default async function JustificacionesBandeja({ searchParams }: { searchParams?: { status?: string } }) {
  const status = (searchParams?.status ?? "pending").trim();

  // Listado base
  const { data: rows } = await supabaseAdmin
    .from("attendance_justifications")
    .select("id, session_id, student_id, reason, evidence_path, status, reviewer_id, reviewed_at, created_at")
    .eq("status", status)
    .order("created_at", { ascending: false })
    .limit(100);

  // Juntar info de sesión y alumno
  const sessionIds = Array.from(new Set((rows ?? []).map(r => r.session_id)));
  const studentIds = Array.from(new Set((rows ?? []).map(r => r.student_id)));

  const [{ data: sess }, { data: profs }, { data: sps }] = await Promise.all([
    sessionIds.length
      ? supabaseAdmin.from("sessions").select("id, session_date, start_planned, room_code, subjectId").in("id", sessionIds)
      : Promise.resolve({ data: [] }),
    studentIds.length
      ? supabaseAdmin.from("profiles").select("user_id, email").in("user_id", studentIds as any)
      : Promise.resolve({ data: [] }),
    studentIds.length
      ? supabaseAdmin.from("StudentProfile").select('userId, "fullName","first_name","last_name"').in("userId", studentIds as any)
      : Promise.resolve({ data: [] }),
  ]);

  const subjIds = Array.from(new Set((sess ?? []).map((s:any) => s.subjectId).filter(Boolean)));
  const { data: subs } = subjIds.length
    ? await supabaseAdmin.from("Subject").select("id, name").in("id", subjIds)
    : { data: [] as any[] };

  const subjMap = new Map<number, string>();
  (subs ?? []).forEach((s:any) => subjMap.set(s.id, s.name ?? ""));

  const sessMap = new Map<number, any>();
  (sess ?? []).forEach((s:any) => sessMap.set(s.id, s));

  const nameByUser: Record<string, string> = {};
  (sps ?? []).forEach((sp:any) => {
    const nm = sp.fullName || [sp.first_name, sp.last_name].filter(Boolean).join(" ");
    nameByUser[sp.userId] = (nm || "").trim();
  });
  const emailByUser: Record<string, string> = {};
  (profs ?? []).forEach((p:any) => { emailByUser[p.user_id] = p.email; });

  // Signed URLs para evidencia (si hay)
  async function sign(path: string | null) {
    if (!path) return null;
    const signed = await supabaseAdmin.storage.from("justifications").createSignedUrl(path, 60 * 15);
    return signed.data?.signedUrl ?? null;
  }
  const signedMap = new Map<number, string | null>();
  for (const r of rows ?? []) {
    signedMap.set(r.id, await sign(r.evidence_path ?? null));
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Justificaciones</h1>

      <form className="flex gap-2">
        <select name="status" defaultValue={status} className="px-2 py-1 border rounded">
          <option value="pending">Pendientes</option>
          <option value="approved">Aprobadas</option>
          <option value="rejected">Rechazadas</option>
        </select>
        <button className="px-3 py-1 border rounded" type="submit">Filtrar</button>
      </form>

      <div className="border rounded">
        <div className="grid grid-cols-12 bg-gray-50 px-3 py-2 text-sm font-medium">
          <div className="col-span-3 text-black">Alumno</div>
          <div className="col-span-3 text-black">Sesión</div>
          <div className="col-span-3 text-black">Motivo</div>
          <div className="col-span-3 text-black">Acciones</div>
        </div>
        <div>
          {(rows ?? []).map((r:any) => {
            const s = sessMap.get(r.session_id);
            const subjName = s?.subjectId ? (subjMap.get(s.subjectId) ?? "—") : "—";
            const alumno = nameByUser[r.student_id] || emailByUser[r.student_id] || r.student_id;
            return (
              <div key={r.id} className="grid grid-cols-12 border-t px-3 py-2 text-sm items-start gap-2">
                <div className="col-span-3">
                  <div className="font-medium">{alumno}</div>
                  <div className="text-xs opacity-70">{emailByUser[r.student_id] ?? "—"}</div>
                </div>
                <div className="col-span-3">
                  <div>{s?.session_date ?? "—"} · {hhmm(s?.start_planned)}</div>
                  <div className="text-xs opacity-70">{subjName} · Salón {s?.room_code ?? "—"}</div>
                </div>
                <div className="col-span-3">
                  <div className="line-clamp-3">{r.reason}</div>
                  {signedMap.get(r.id) && (
                    <a className="text-xs underline" href={signedMap.get(r.id)!} target="_blank">Ver evidencia</a>
                  )}
                </div>
                <div className="col-span-3 flex flex-wrap gap-2">
                  {r.status === "pending" ? (
                    <>
                      <form action={`/staff/control-escolar/justificaciones/approve`} method="post">
                        <input type="hidden" name="id" value={r.id} />
                        <button className="px-2 py-1 border rounded text-xs">Aprobar</button>
                      </form>
                      <form action={`/staff/control-escolar/justificaciones/reject`} method="post">
                        <input type="hidden" name="id" value={r.id} />
                        <button className="px-2 py-1 border rounded text-xs">Rechazar</button>
                      </form>
                    </>
                  ) : (
                    <div className="text-xs">
                      Estado: <b>{r.status}</b><br/>
                      {r.reviewed_at ? new Date(r.reviewed_at).toLocaleString() : ""}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {(!rows || !rows.length) && <div className="p-4 text-sm opacity-70">Sin registros.</div>}
        </div>
      </div>
    </div>
  );
}
