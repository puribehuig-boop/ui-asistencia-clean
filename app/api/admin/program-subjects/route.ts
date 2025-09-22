import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/api";
export const runtime = "nodejs";

/** GET /api/admin/program-subjects?programId=1 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const programId = Number(url.searchParams.get("programId"));
    if (!Number.isFinite(programId)) return fail("programId requerido", 400);

    const rows = await prisma.programSubject.findMany({
      where: { programId },
      orderBy: [{ term: "asc" }, { subjectId: "asc" }],
      include: { subject: true, program: true },
    });
    return ok({ items: rows });
  } catch (e) { return fail(e); }
}

/** POST { programId, subjectId, term } */
export async function POST(req: Request) {
  try {
    const b = await req.json();
    const programId = Number(b?.programId);
    const subjectId = Number(b?.subjectId);
    const term = Number(b?.term);

    if (![programId, subjectId, term].every(Number.isFinite))
      return fail("programId/subjectId/term inválidos", 400);

    // Evita duplicado lógico (también lo bloquea el UNIQUE en BD)
    const exists = await prisma.programSubject.findUnique({
      where: { programId_subjectId_term: { programId, subjectId, term } },
    });
    if (exists) return fail("Ya existe esa asignación", 409);

    const created = await prisma.programSubject.create({
      data: { programId, subjectId, term },
    });
    return ok({ item: created }, 201);
  } catch (e) { return fail(e); }
}

/** DELETE  body: { programId, subjectId, term } */
export async function DELETE(req: Request) {
  try {
    const b = await req.json();
    const programId = Number(b?.programId);
    const subjectId = Number(b?.subjectId);
    const term = Number(b?.term);

    if (![programId, subjectId, term].every(Number.isFinite))
      return fail("programId/subjectId/term inválidos", 400);

    await prisma.programSubject.delete({
      where: { programId_subjectId_term: { programId, subjectId, term } },
    });
    return ok({ deleted: { programId, subjectId, term } });
  } catch (e) { return fail(e); }
}
