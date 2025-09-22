import { NextResponse } from 'next/server';
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function parseFromSessionCode(code: string) {
  // Formato esperado: <room>-YYYYMMDD-<HHMM|manual>
  const m = code.match(/-(\d{8})-(\d{4}|manual)$/);
  if (!m) return null;
  const dateStr = m[1];
  const startStr = m[2];
  const room = code.slice(0, m.index!); // todo antes de -YYYYMMDD-
  return { room_code: room, dateStr, startStr };
}

function hhmm_to_time(hhmm: string) {
  return `${hhmm.slice(0,2)}:${hhmm.slice(2,4)}`; // 0800 -> 08:00
}

// 0=domingo ... 6=sábado para una fecha específica (zona MX)
function weekdayFromDate(dateStr: string) {
  const y = Number(dateStr.slice(0,4));
  const m = Number(dateStr.slice(4,6)) - 1;
  const d = Number(dateStr.slice(6,8));
  const dt = new Date(Date.UTC(y, m, d, 12, 0, 0)); // UTC medio día para evitar DST issues
  return dt.getUTCDay(); // 0..6 (mapeo universal)
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const session_code = String(body?.sessionId || '').trim();
    if (!session_code) {
      return NextResponse.json({ ok: false, error: 'missing_sessionId' }, { status: 400 });
    }

    const parsed = parseFromSessionCode(session_code);
    const now = new Date();
    const session_date =
      parsed?.dateStr
        ? `${parsed.dateStr.slice(0,4)}-${parsed.dateStr.slice(4,6)}-${parsed.dateStr.slice(6,8)}`
        : new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(now);

    let room_code = body?.roomId ? String(body.roomId).trim() : (parsed?.room_code || '');
    if (!room_code) {
      return NextResponse.json({ ok: false, error: 'missing_room' }, { status: 400 });
    }

    // Intentamos completar materia/grupo/fin_plan si el code trae inicio HHMM
    let subject = body?.subject ? String(body.subject) : null;
    let group_name = body?.group_name ? String(body.group_name) : null;
    let start_planned: string | null = null;
    let end_planned: string | null = null;
    let arrival_status: 'on_time'|'late'|'too_late' | null = null;
    let arrival_delay_min: number | null = null;

    if (parsed && parsed.startStr !== 'manual') {
      const startStr = parsed.startStr;       // '0800'
      const startHHMM = hhmm_to_time(startStr); // '08:00'
      const wd = weekdayFromDate(parsed.dateStr); // 0..6

      // Lee tolerancias
      const { data: settings } = await supabaseAdmin
        .from('global_settings')
        .select('attendance_tolerance_min, late_threshold_min')
        .eq('id', 1)
        .maybeSingle();
      const tol = settings?.attendance_tolerance_min ?? 15;
      const late = settings?.late_threshold_min ?? 30;

      // Busca el slot exacto
      const { data: slot } = await supabaseAdmin
        .from('schedule_slots')
        .select('subject, group_name, start_time, end_time')
        .eq('room_code', room_code)
        .eq('weekday', wd)
        .eq('start_time', startHHMM)
        .maybeSingle();

      if (slot) {
        subject = subject ?? slot.subject;
        group_name = group_name ?? slot.group_name;
        start_planned = String(slot.start_time).slice(0,5);
        end_planned   = String(slot.end_time).slice(0,5);

        // Clasificar llegada
        const nowMx = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City', hour12: false, hour: '2-digit', minute: '2-digit' }).format(now);
        const toMin = (s: string) => {
          const [h, m] = s.split(':').map(Number);
          return h*60 + m;
        };
        const delay = toMin(nowMx) - toMin(start_planned);
        arrival_delay_min = Math.max(0, delay);
        if (delay <= tol) arrival_status = 'on_time';
        else if (delay <= late) arrival_status = 'late';
        else arrival_status = 'too_late';
      }
    }

    // Si llega demasiado tarde según reglas, marcamos status='blocked' (no iniciamos)
    const status =
      arrival_status === 'too_late' ? 'blocked' :
      'in_progress';

    // UPSERT por session_code
    const payload: any = {
      session_code,
      room_code,
      subject,
      group_name,
      session_date,
      start_planned,
      end_planned,
      arrival_status,
      arrival_delay_min,
      status,
      started_at: new Date().toISOString()
    };

    // Si ya existe, no pisar started_at si ya tenía
    const { data: existing } = await supabaseAdmin
      .from('sessions')
      .select('id, started_at')
      .eq('session_code', session_code)
      .maybeSingle();

    if (existing?.id) {
      delete payload.started_at;
      const { error: updErr } = await supabaseAdmin
        .from('sessions')
        .update({
          ...payload,
          started_at: existing.started_at ?? new Date().toISOString()
        })
        .eq('id', existing.id);
      if (updErr) return NextResponse.json({ ok: false, error: updErr.message }, { status: 500 });
      return NextResponse.json({ ok: true, id: existing.id, status: payload.status, arrival_status, arrival_delay_min });
    } else {
      const { data: ins, error: insErr } = await supabaseAdmin
        .from('sessions')
        .insert(payload)
        .select('id')
        .maybeSingle();
      if (insErr) return NextResponse.json({ ok: false, error: insErr.message }, { status: 500 });
      return NextResponse.json({ ok: true, id: ins?.id, status, arrival_status, arrival_delay_min });
    }
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
