// lib/api.ts
export function ok(data: any, init?: number) {
  return new Response(JSON.stringify({ ok: true, ...data }), {
    status: init ?? 200,
    headers: { "content-type": "application/json" },
  });
}

export function fail(error: unknown, init?: number) {
  return new Response(JSON.stringify({ ok: false, error: String(error) }), {
    status: init ?? 500,
    headers: { "content-type": "application/json" },
  });
}
