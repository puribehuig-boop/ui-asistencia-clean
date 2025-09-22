// app/auth/session/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { access_token, refresh_token } = await req.json();

    if (!access_token || !refresh_token) {
      return NextResponse.json({ ok: false, error: "missing tokens" }, { status: 400 });
    }

    // Respuesta sobre la que vamos a escribir cookies
    const res = NextResponse.json({ ok: true });

    // Client SSR con adaptadores de cookies que escriben en 'res'
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: any) {
            res.cookies.set(name, value, options as any);
          },
          remove(name: string, options: any) {
            res.cookies.set(name, "", { ...(options as any), maxAge: 0 });
          },
        },
      }
    );

    const { error } = await supabase.auth.setSession({
      access_token,
      refresh_token,
    });
    if (error) {
      return NextResponse.json({ ok: false, error: String(error) }, { status: 401 });
    }

    return res; // devolver la respuesta que lleva Set-Cookie
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
