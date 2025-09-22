import { NextResponse } from 'next/server';
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const session_code = String(body?.sessionId || '').trim();
    if (!session_code) return NextResponse.json({ ok: false, error: 'missing_sessionId' }, { status: 400 });

    const { data: existing, error: selErr } = await supabaseAdmin
      .from('sessions')
      .select('id')
      .eq('session_code', session_code)
      .maybeSingle();

    if (selErr) return NextResponse.json({ ok: false, error: selErr.message }, { status: 500 });
    if (!existing?.id) return NextResponse.json({ ok: false, error: 'session_not_found' }, { status: 404 });

    const { error: updErr } = await supabaseAdmin
      .from('sessions')
      .update({ status: 'finished', ended_at: new Date().toISOString() })
      .eq('id', existing.id);

    if (updErr) return NextResponse.json({ ok: false, error: updErr.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
