// app/api/staff/admissions/prospects/create/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/serverClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function isValidEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}
function normalizePhone(v: string) {
  // Remueve caracteres no útiles; conserva dígitos y + - () espacio
  const cleaned = v.replace(/[^\d+()\-\s]/g, "").trim();
  return cleaned || null;
}

export async function POST(req: Request) {
  const supabase = createSupabaseServerClient();

  // Guard
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    return NextResponse.redirect(new URL(`/staff/admissions/prospects/new?error=${encodeURIComponent("Debes iniciar sesión")}`, req.url));
  }
  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", auth.user.id)
    .maybeSingle();

  const role = (me?.role ?? "").toLowerCase();
  if (!["admin","admissions"].includes(role)) {
    return NextResponse.redirect(new URL(`/staff/admissions/prospects/new?error=${encodeURIComponent("No tienes permisos")}`, req.url));
  }

  const form = await req.formData();

  const full_name_raw = (form.get("full_name") as string) ?? "";
  const email_raw = (form.get("email") as string) ?? "";
  const phone_raw = (form.get("phone") as string) ?? "";

  const full_name = full_name_raw.trim() || null;
  const email = email_raw.trim().toLowerCase() || null;
  const phone = phone_raw.trim() ? normalizePhone(phone_raw) : null;

  if (!email && !phone) {
    const u = new URL("/staff/admissions/prospects/new", req.url);
    u.searchParams.set("error", "Proporciona email y/o teléfono.");
    if (email_raw) u.searchParams.set("email", email_raw);
    if (phone_raw) u.searchParams.set("phone", phone_raw);
    if (full_name_raw) u.searchParams.set("full_name", full_name_raw);
    return NextResponse.redirect(u);
  }

  if (email && !isValidEmail(email)) {
    const u = new URL("/staff/admissions/prospects/new", req.url);
    u.searchParams.set("error", "El email no es válido.");
    if (email_raw) u.searchParams.set("email", email_raw);
    if (phone_raw) u.searchParams.set("phone", phone_raw);
    if (full_name_raw) u.searchParams.set("full_name", full_name_raw);
    return NextResponse.redirect(u);
  }

  // Buscar duplicados (match exacto por email o teléfono normalizado)
  // Nota: si tienes teléfonos antiguos sin normalizar, podemos robustecer esto luego con una columna computed.
  let duplicate: number | null = null;

  if (email) {
    const { data: byEmail } = await supabase
      .from("prospects")
      .select("id")
      .eq("email", email)
      .limit(1)
      .maybeSingle();
    if (byEmail?.id) duplicate = byEmail.id;
  }

  if (!duplicate && phone) {
    const { data: byPhone } = await supabase
      .from("prospects")
      .select("id")
      .eq("phone", phone)
      .limit(1)
      .maybeSingle();
    if (byPhone?.id) duplicate = byPhone.id;
  }

  if (duplicate) {
    // Redirige al detalle del existente
    return NextResponse.redirect(new URL(`/staff/admissions/prospects/${duplicate}`, req.url));
  }

  // Crear prospecto
  const { data, error } = await supabase
    .from("prospects")
    .insert([{
      full_name,
      email,
      phone,
      stage: "nuevo",
    }])
    .select("id")
    .maybeSingle();

  if (error || !data?.id) {
    const u = new URL("/staff/admissions/prospects/new", req.url);
    u.searchParams.set("error", error?.message ?? "No se pudo crear el prospecto");
    if (email_raw) u.searchParams.set("email", email_raw);
    if (phone_raw) u.searchParams.set("phone", phone_raw);
    if (full_name_raw) u.searchParams.set("full_name", full_name_raw);
    return NextResponse.redirect(u);
  }

  // Ir al detalle recién creado
  return NextResponse.redirect(new URL(`/staff/admissions/prospects/${data.id}`, req.url));
}
