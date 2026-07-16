import { PrismaClient } from "@prisma/client";

// Re-export a singleton PrismaClient for use across apps.
// Apps should import from "@repo/db" rather than instantiating their own client.

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env["NODE_ENV"] === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env["NODE_ENV"] !== "production") {
  globalForPrisma.prisma = prisma;
}

// Re-export all Prisma-generated types so consumers never need @prisma/client directly
export * from "@prisma/client";

export default prisma;
