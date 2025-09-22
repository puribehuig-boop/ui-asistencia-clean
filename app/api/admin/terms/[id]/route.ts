import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/api";
export const runtime = "nodejs";

export async function DELETE(_: Request, ctx: { params: { id: string } }) {
  try {
    const id = Number(ctx.params.id);
    if (!Number.isFinite(id)) return fail("id inválido", 400);
    await prisma.term.delete({ where: { id } });
    return ok({ deleted: id });
  } catch (e) {
    return fail(e);
  }
}

export async function PUT(req: Request, ctx: { params: { id: string } }) {
  try {
    const id = Number(ctx.params.id);
    const b = await req.json();
    const name = String(b?.name || "").trim();
    const startDate = new Date(b?.startDate);
    const endDate = new Date(b?.endDate);

    if (!Number.isFinite(id) || !name || isNaN(startDate.getTime()) || isNaN(endDate.getTime()))
      return fail("id/name/startDate/endDate inválidos", 400);

    const updated = await prisma.term.update({ where: { id }, data: { name, startDate, endDate } });
    return ok({ term: updated });
  } catch (e) {
    return fail(e);
  }
}
