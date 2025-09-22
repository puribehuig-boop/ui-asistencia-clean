import { NextResponse } from 'next/server';
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const session_code = String(url.searchParams.get('sessionId') || '').trim();
    if (!session_code) return NextResponse.json({ ok: false, error: 'missing_sessionId' }, { status: 400 });

    const { data: ses } = await supabaseAdmin
      .from('sessions')
      .select('id')
      .eq('session_code', session_code)
      .maybeSingle();

    if (!ses?.id) {
      return NextResponse.json({ ok: true, items: [] }); // sin sesión, sin asistencias aún
    }

    const { data, error } = await supabaseAdmin
      .from('attendance')
      .select('student_id, student_name, status, updated_at, updated_by')
      .eq('session_id', ses.id)
      .order('student_name', { ascending: true });

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, items: data || [] });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
