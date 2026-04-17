import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pool: Pool | undefined;
};

function hasDynamicPagesDelegate(client: PrismaClient | undefined) {
  if (!client) return false;
  return typeof (client as unknown as { dynamicPage?: unknown }).dynamicPage === "object";
}

const pool =
  globalForPrisma.pool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
  });

function createClient() {
  return new PrismaClient({
    adapter: new PrismaPg(pool),
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });
}

function getClient() {
  const current = globalForPrisma.prisma;
  if (hasDynamicPagesDelegate(current)) return current;

  if (current && process.env.NODE_ENV !== "production") {
    void current.$disconnect().catch(() => undefined);
  }

  const next = createClient();
  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = next;
  }
  return next;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = getClient();
    // Important: Prisma Client exposes many getters that rely on `this` being the
    // actual PrismaClient instance. Use the real client as the receiver so
    // model delegates (e.g. `dynamicPage`) are resolved correctly.
    const value = Reflect.get(client as unknown as object, prop, client as unknown as object);
    if (typeof value === "function") {
      return value.bind(client);
    }
    return value;
  },
}) as PrismaClient;

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.pool = pool;
  globalForPrisma.prisma = getClient();
}
