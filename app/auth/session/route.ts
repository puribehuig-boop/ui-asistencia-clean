// app/auth/session/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function POST(req: Request) {
  try {
    const { access_token, refresh_token } = await req.json();

    if (!access_token || !refresh_token) {
      return NextResponse.json({ ok: false, error: "missing tokens" }, { status: 400 });
    }

    // Preparamos la respuesta donde vamos a ESCRIBIR las cookies de sesión
    const res = NextResponse.json({ ok: true });

    // Creamos un Supabase server client con adaptadores de cookies
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
            // Escribimos en la respuesta (Set-Cookie)
            res.cookies.set(name, value, options as any);
          },
          remove(name: string, options: any) {
            res.cookies.set(name, "", { ...(options as any), maxAge: 0 });
          },
        },
      }
    );

    // Establece la sesión del lado servidor (esto “imprime” las cookies en 'res')
    const { error } = await supabase.auth.setSession({
      access_token,
      refresh_token,
    });

    if (error) {
      return NextResponse.json({ ok: false, error: String(error) }, { status: 401 });
    }

    // 👈 MUY IMPORTANTE: devolver 'res' (la que lleva Set-Cookie)
    return res;
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
