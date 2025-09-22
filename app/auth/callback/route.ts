// app/auth/callback/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");

  // Preparamos la redirección y ESCRIBIMOS cookies ahí
  const res = NextResponse.redirect(new URL("/admin", req.url));

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => req.cookies.get(name)?.value,
        set: (name: string, value: string, options: any) => {
          res.cookies.set(name, value, options as any);
        },
        remove: (name: string, options: any) => {
          res.cookies.set(name, "", { ...(options as any), maxAge: 0 });
        },
      },
    }
  );

  if (code) {
    await supabase.auth.exchangeCodeForSession(code);
  }

  return res; // 👈 devolvemos la respuesta que ya trae Set-Cookie
}
