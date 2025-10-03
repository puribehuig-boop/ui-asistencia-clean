// app/api/staff/admissions/prospects/[id]/update/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/serverClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function isValidEmail(v: string) {
  // validación simple y suficiente para UI (RFC completo no es necesario aquí)
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function normalizePhone(v: string) {
  // quita espacios y mantiene dígitos y +, - y paréntesis básicos
  const cleaned = v.replace(/[^\d+()\-\s]/g, "").trim();
  return cleaned || null;
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();

  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return NextResponse.json({ ok:false, error:"unauthorized" }, { status: 401 });

  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", auth.user.id)
    .maybeSingle();

  const role = (me?.role ?? "").toLowerCase();
  if (!["admin", "admissions"].includes(role)) {
    return NextResponse.json({ ok:false, error:"forbidden" }, { status: 403 });
  }

  const prospectId = Number(params.id || 0);
  if (!prospectId) return NextResponse.json({ ok:false, error:"bad_id" }, { status: 400 });

  const form = await req.formData();

  // Campos de contacto (opcionales)
  const full_name_raw = form.get("full_name");
  const email_raw = form.get("email");
  const phone_raw = form.get("phone");

  // Catálogos (opcionales)
  const source = (form.get("source") as string) || null;
  const termRaw = form.get("term_id") as string | null;
  const term_id = termRaw ? Number(termRaw) : null;

  const programRaw = form.get("program_id") as string | null;
  const program_id = programRaw ? Number(programRaw) : null;

  // Validaciones suaves
  const patch: Record<string, unknown> = {};

  if (typeof full_name_raw === "string") {
    const v = full_name_raw.trim();
    patch.full_name = v.length ? v : null;
  }

  if (typeof email_raw === "string") {
    const v = email_raw.trim();
    if (v.length) {
      if (!isValidEmail(v)) {
        return NextResponse.json({ ok:false, error:"email_invalid" }, { status: 400 });
      }
      patch.email = v.toLowerCase();
    } else {
      patch.email = null;
    }
  }

  if (typeof phone_raw === "string") {
    const v = phone_raw.trim();
    patch.phone = v.length ? normalizePhone(v) : null;
  }

  // Catálogos
  if (form.has("source")) patch.source = source;
  if (form.has("term_id")) patch.term_id = term_id;
  if (form.has("program_id")) patch.program_id = program_id;

  if (Object.keys(patch).length === 0) {
    // nada que actualizar: regresamos al detalle
    return NextResponse.redirect(new URL(`/staff/admissions/prospects/${prospectId}`, req.url));
  }

  const { error } = await supabase
    .from("prospects")
    .update(patch)
    .eq("id", prospectId);

  if (error) return NextResponse.json({ ok:false, error: error.message }, { status: 500 });

  return NextResponse.redirect(new URL(`/staff/admissions/prospects/${prospectId}`, req.url));
}
