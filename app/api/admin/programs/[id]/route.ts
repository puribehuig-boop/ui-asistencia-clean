// app/api/admin/programs/[id]/route.ts
import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/api";

export const runtime = "nodejs";

export async function DELETE(_: Request, ctx: { params: { id: string } }) {
  try {
    const id = Number(ctx.params.id);
    if (!Number.isFinite(id)) return fail("id inválido", 400);
    await prisma.program.delete({ where: { id } });
    return ok({ deleted: id });
  } catch (e) {
    return fail(e);
  }
}

export async function PUT(req: Request, ctx: { params: { id: string } }) {
  try {
    const id = Number(ctx.params.id);
    const body = await req.json();
    const name = String(body?.name || "").trim();

    if (!Number.isFinite(id) || !name) return fail("id/nombre inválidos", 400);

    // Evita duplicado por nombre (opcional si ya tienes UNIQUE en DB)
    const dupe = await prisma.program.findFirst({ where: { name } });
    if (dupe && dupe.id !== id) return fail("Ya existe un programa con ese nombre", 409);

    const updated = await prisma.program.update({ where: { id }, data: { name } });
    return ok({ program: updated });
  } catch (e) {
    return fail(e);
  }
}
