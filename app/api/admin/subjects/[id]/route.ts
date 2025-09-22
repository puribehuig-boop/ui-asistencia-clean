import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/api";
export const runtime = "nodejs";

export async function DELETE(_: Request, ctx: { params: { id: string } }) {
  try {
    const id = Number(ctx.params.id);
    if (!Number.isFinite(id)) return fail("id inválido", 400);
    await prisma.subject.delete({ where: { id } });
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
    const name = String(b?.name || "").trim();

    if (!Number.isFinite(id) || !code || !name) return fail("id/code/name inválidos", 400);

    // Evita duplicado por code (si ya tienes UNIQUE en DB, esto da mejor error)
    const dupe = await prisma.subject.findFirst({ where: { code } });
    if (dupe && dupe.id !== id) return fail("Ya existe una materia con ese código", 409);

    const updated = await prisma.subject.update({ where: { id }, data: { code, name } });
    return ok({ subject: updated });
  } catch (e) {
    return fail(e);
  }
}
