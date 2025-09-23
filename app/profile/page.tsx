// app/profile/page.tsx
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/serverClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ProfilePage() {
  const supabase = createSupabaseServerClient();

  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) redirect("/login");

  const { data: profile, error: pErr } = await supabase
    .from("profiles")
    .select("user_id,email,role")
    .eq("user_id", user.id)
    .maybeSingle();
  if (pErr) return <div className="p-6 text-red-600">Error: {pErr.message}</div>;

  let teacher: any = null;
  if (profile?.role === "docente") {
    const { data: t, error: tErr } = await supabase
      .from("teacher_profile")
      .select("display_name, first_name, last_name, alt_email, phone, edad, photo_url, curp, rfc, direccion, plantel, licenciatura, cedula_lic, maestria, cedula_maest, doctorado, cedula_doct, estado_civil, nacionalidad")
      .eq("user_id", user.id)
      .maybeSingle();
    if (tErr) return <div className="p-6 text-red-600">Error: {tErr.message}</div>;
    teacher = t;
  }

  const displayName =
    teacher?.display_name ||
    [teacher?.first_name, teacher?.last_name].filter(Boolean).join(" ") ||
    user.user_metadata?.name ||
    profile?.email?.split("@")[0];

  // ... pinta tu UI como ya la tienes (cabecera + bloque docente si aplica)
  return <div className="p-6">Perfil de {displayName}</div>;
}
