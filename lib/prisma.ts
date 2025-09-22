// lib/prisma.ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = global as unknown as { prisma?: PrismaClient };

function withPgBouncerParam(url: string | undefined) {
  if (!url) return url;
  const hasQuery = url.includes("?");
  const hasPgbouncer = /(^|[?&])pgbouncer=true(&|$)/.test(url);
  if (hasPgbouncer) return url;
  return url + (hasQuery ? "&" : "?") + "pgbouncer=true";
}

const DB_URL = withPgBouncerParam(process.env.DATABASE_URL);

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: { db: { url: DB_URL } }, // 👈 fuerza pgbouncer=true
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
