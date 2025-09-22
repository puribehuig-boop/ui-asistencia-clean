import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/api";
export const runtime = "nodejs";

export async function DELETE(_: Request, ctx: { params: { id: string } }) {
  try {
    const id = Number(ctx.params.id);
    if (!Number.isFinite(id)) return fail("id inválido", 400);
    await prisma.group.delete({ where: { id } });
    return ok({ deleted: id });
  } catch (e) {
    return fail(e);
  }
}

export async function PUT(req: Request, ctx: { params: { id: string } }) {
  try {
    const id = Number(ctx.params.id);
    const b = await req.json();
    const code = String(b?.code || "").trim();
    const termId = Number(b?.termId);

    if (!Number.isFinite(id) || !code || !Number.isFinite(termId))
      return fail("id/code/termId inválidos", 400);

    // Evita duplicado por code
    const dupe = await prisma.group.findFirst({ where: { code } });
    if (dupe && dupe.id !== id) return fail("Ya existe un grupo con ese código", 409);

    const updated = await prisma.group.update({ where: { id }, data: { code, termId } });
    return ok({ group: updated });
  } catch (e) {
    return fail(e);
  }
}
