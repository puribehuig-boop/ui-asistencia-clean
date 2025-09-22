import { prisma } from "@/lib/prisma"; import { ok, fail } from "@/lib/api";
export const runtime = "nodejs";

export async function GET(){ try{
  const subjects = await prisma.subject.findMany({ orderBy:{ id:"asc" }});
  return ok({ subjects });
}catch(e){ return fail(e); }}

export async function POST(req:Request){ try{
  const b = await req.json();
  const code = String(b?.code||"").trim();
  const name = String(b?.name||"").trim();
  if(!code || !name) return fail("code y name requeridos", 400);
  const existing = await prisma.subject.findFirst({ where:{ code }});
  const subject = existing ?? (await prisma.subject.create({ data:{ code, name }}));
  return ok({ subject }, existing ? 200 : 201);
}catch(e){ return fail(e); }}
