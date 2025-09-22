// lib/session.ts
export function parseFromSessionCode(code: string) {
  const m = code.match(/-(\d{8})-(\d{4}|manual)$/);
  if (!m) return null;
  const dateStr = m[1];
  const startStr = m[2];
  const room = code.slice(0, m.index!);
  return { room_code: room, dateStr, startStr };
}

export const hhmmToTime = (hhmm: string) =>
  `${hhmm.slice(0,2)}:${hhmm.slice(2,4)}`;
