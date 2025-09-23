export const runtime = "nodejs";
export async function GET(req: Request) {
  const url = new URL(req.url);
  const dest = new URL(`/scan${url.search}`, url.origin);
  return Response.redirect(dest, 302);
}
