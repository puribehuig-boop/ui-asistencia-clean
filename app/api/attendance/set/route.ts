import { parseFromSessionCode } from "@/lib/session";
import { createSupabaseServerClient } from "@/lib/supabase/serverClient";
import { NextResponse } from 'next/server';
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const ALLOWED = ['Presente','Tarde','Ausente','Justificado'] as const;
type Estado = typeof ALLOWED[number];

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const session_code = String(body?.sessionId || '').trim();
    const roomId       = String(body?.roomId || '').trim();
    const student_id   = String(body?.studentId || '').trim();
    const student_name = String(body?.studentName || '').trim();
    const status       = String(body?.status || '').trim() as Estado;

    if (!session_code) return NextResponse.json({ ok: false, error: 'missing_sessionId' }, { status: 400 });
    if (!student_id || !student_name) return NextResponse.json({ ok: false, error: 'missing_student' }, { status: 400 });
    if (!ALLOWED.includes(status)) return NextResponse.json({ ok: false, error: 'invalid_status' }, { status: 400 });

    // Quién es (si viene token)
    let updated_by = 'anon';
    const supabase = createSupabaseServerClient();
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (user?.email) updated_by = user.email;
    = await supabase.auth.getUser(token);
      const user = userRes?.user;
      if (user?.email) updated_by = user.email;
    }

    // Asegurar sesión
    const { data: existing } = await supabaseAdmin.from('sessions').select('id').eq('session_code', session_code).maybeSingle();
    let session_id = existing?.id as number | undefined;
    if (!session_id) {
      const parsed = parseFromSessionCode(session_code);
      const session_date = parsed?.dateStr
        ? `${parsed.dateStr.slice(0,4)}-${parsed.dateStr.slice(4,6)}-${parsed.dateStr.slice(6,8)}`
        : new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date());
      const room_code = roomId || parsed?.room_code || 'SIN-SALON';
      const { data: ins, error: insErr } = await supabaseAdmin
        .from('sessions').insert({ session_code, room_code, session_date, status: 'not_started' })
        .select('id').maybeSingle();
      if (insErr) return NextResponse.json({ ok: false, error: insErr.message }, { status: 500 });
      session_id = ins?.id;
    }

    // Upsert asistencia
    const { error: upErr } = await supabaseAdmin
      .from('attendance')
      .upsert({
        session_id,
        student_id,
        student_name,
        status,
        updated_by,
        updated_at: new Date().toISOString()
      }, { onConflict: 'session_id,student_id' });

    if (upErr) return NextResponse.json({ ok: false, error: upErr.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
