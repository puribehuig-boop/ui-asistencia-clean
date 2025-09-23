// app/profile/page.tsx
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/serverClient";

export const dynamic = "force-dynamic";   // evita cachear por usuario
export const revalidate = 0;

type ProfileRow = { user_id: string; email: string; role: string };
type TeacherRow = {
  display_name?: string;
  first_name?: string;
  last_name?: string;
  alt_email?: string;
  phone?: string;
  edad?: number;
  photo_url?: string;
  curp?: string;
  rfc?: string;
  direccion?: string;
  plantel?: string;
  licenciatura?: string;
  cedula_lic?: string;
  maestria?: string;
  cedula_maest?: string;
  doctorado?: string;
  cedula_doct?: string;
  estado_civil?: string;
  nacionalidad?: string;
};

function mask(val?: string | null, opts: { keepStart?: number; keepEnd?: number } = {}) {
  if (!val) return "—";
  const keepStart = opts.keepStart ?? 4;
  const keepEnd = opts.keepEnd ?? 2;
  if (val.length <= keepStart + keepEnd) return val;
  const mid = "•".repeat(Math.max(3, val.length - keepStart - keepEnd));
  return `${val.slice(0, keepStart)}${mid}${val.slice(-keepEnd)}`;
}

export default async function ProfilePage() {
  // Si tu helper es función creadora:
  const supabase = typeof serverClient === "function" ? serverClient() : serverClient;

  // 1) Usuario autenticado
  const { data: auth, error: authErr } = await supabase.auth.getUser();
  if (authErr) {
    return (<div className="p-6 text-red-600">Error de autenticación: {authErr.message}</div>);
  }
  const user = auth?.user ?? null;
  if (!user) {
    // Si prefieres mostrar mensaje en lugar de redirigir, cambia esta línea.
    redirect("/login");
  }

  // 2) Perfil base (RLS: (user_id = auth.uid()) OR is_admin())
  const { data: p, error: pErr } = await supabase
    .from("profiles")
    .select("user_id,email,role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (pErr) {
    return (<div className="p-6 text-red-600">Error cargando perfil: {pErr.message}</div>);
  }
  const profile = p as ProfileRow | null;
  if (!profile) {
    return (<div className="p-6">No se encontró tu perfil.</div>);
  }

  // 3) Si es docente, traer teacher_profile (RLS: SELECT authenticated)
  let teacher: TeacherRow | null = null;
  if (profile.role === "docente") {
    const { data: t, error: tErr } = await supabase
      .from("teacher_profile")
      .select(`
        display_name, first_name, last_name, alt_email, phone, edad, photo_url,
        curp, rfc, direccion, plantel, licenciatura, cedula_lic,
        maestria, cedula_maest, doctorado, cedula_doct, estado_civil, nacionalidad
      `)
      .eq("user_id", user.id)
      .maybeSingle();
    if (tErr) {
      return (<div className="p-6 text-red-600">Error cargando datos de docente: {tErr.message}</div>);
    }
    teacher = t as TeacherRow | null;
  }

  const displayName =
    teacher?.display_name ||
    [teacher?.first_name, teacher?.last_name].filter(Boolean).join(" ") ||
    (user.user_metadata?.name as string | undefined) ||
    profile.email.split("@")[0];

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Perfil</h1>

      <section className="flex items-center gap-4 border rounded p-4 bg-gray-50">
        <Avatar name={displayName} src={teacher?.photo_url} />
        <div className="flex-1">
          <div className="text-lg font-medium">{displayName}</div>
          <div className="text-sm opacity-80">{profile.email}</div>
          <div className="text-sm">
            Rol: <span className="font-medium">{profile.role}</span>
          </div>
        </div>
      </section>

      {profile.role === "docente" && (
        <section className="border rounded p-4">
          <h2 className="font-medium mb-3">Datos del docente</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <Field label="Nombre" value={displayName} />
            <Field label="Teléfono" value={teacher?.phone || "—"} />
            <Field label="Correo alterno" value={teacher?.alt_email || "—"} />
            <Field label="Edad" value={teacher?.edad != null ? String(teacher.edad) : "—"} />
            <Field label="CURP" value={mask(teacher?.curp)} />
            <Field label="RFC" value={mask(teacher?.rfc)} />
            <Field label="Dirección" value={teacher?.direccion || "—"} />
            <Field label="Plantel" value={teacher?.plantel || "—"} />
            <Field label="Licenciatura" value={teacher?.licenciatura || "—"} />
            <Field label="Cédula Lic." value={teacher?.cedula_lic || "—"} />
            <Field label="Maestría" value={teacher?.maestria || "—"} />
            <Field label="Cédula Maest." value={teacher?.cedula_maest || "—"} />
            <Field label="Doctorado" value={teacher?.doctorado || "—"} />
            <Field label="Cédula Doct." value={teacher?.cedula_doct || "—"} />
            <Field label="Estado civil" value={teacher?.estado_civil || "—"} />
            <Field label="Nacionalidad" value={teacher?.nacionalidad || "—"} />
          </div>
        </section>
      )}

      <p className="text-xs opacity-60">
        Estos datos se muestran según tu rol y permisos. Para corregir información, contacta al administrador.
      </p>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="opacity-60">{label}</span>
      <span className="font-medium break-words">{value || "—"}</span>
    </div>
  );
}

function Avatar({ name, src }: { name?: string; src?: string | null }) {
  const initials =
    (name || "")
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join("") || "👤";
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="foto" className="w-16 h-16 rounded-full object-cover" />
  ) : (
    <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center text-xl">
      {initials}
    </div>
  );
}
