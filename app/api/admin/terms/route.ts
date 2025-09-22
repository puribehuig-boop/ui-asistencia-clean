import { prisma } from "@/lib/prisma"; import { ok, fail } from "@/lib/api";
export const runtime = "nodejs";

export async function GET(){ try{
  const terms = await prisma.term.findMany({ orderBy:{ id:"asc" }});
  return ok({ terms });
}catch(e){ return fail(e); }}

export async function POST(req:Request){ try{
  const b=await req.json();
  const name=String(b?.name||"").trim();
  const startDate=new Date(b?.startDate);
  const endDate=new Date(b?.endDate);
  if(!name || isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return fail("name/startDate/endDate requeridos",400);
  const term = await prisma.term.create({ data:{ name, startDate, endDate }});
  return ok({ term }, 201);
}catch(e){ return fail(e); }}
