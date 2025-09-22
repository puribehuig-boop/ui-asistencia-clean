import { prisma } from "@/lib/prisma"; import { ok, fail } from "@/lib/api";
export const runtime = "nodejs";

export async function GET(){ try{
  const groups = await prisma.group.findMany({ orderBy:{ id:"asc" }, include:{ term:true } });
  return ok({ groups });
}catch(e){ return fail(e); }}

export async function POST(req:Request){ try{
  const b=await req.json();
  const code=String(b?.code||"").trim();
  const termId=Number(b?.termId);
  if(!code || !Number.isFinite(termId)) return fail("code y termId requeridos",400);
  const existing = await prisma.group.findFirst({ where:{ code }});
  const group = existing ?? (await prisma.group.create({ data:{ code, termId }}));
  return ok({ group }, existing ? 200 : 201);
}catch(e){ return fail(e); }}
