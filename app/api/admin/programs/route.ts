import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/api";
export const runtime = "nodejs";

export async function GET() {
  try {
    const programs = await prisma.program.findMany({ orderBy: { id: "asc" } });
    return ok({ programs });
  } catch (e) { return fail(e); }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const name = String(body?.name || "").trim();
    if (!name) return fail("Nombre requerido", 400);
    const existing = await prisma.program.findFirst({ where: { name } });
    const program = existing ?? (await prisma.program.create({ data: { name } }));
    return ok({ program }, existing ? 200 : 201);
  } catch (e) { return fail(e); }
}
