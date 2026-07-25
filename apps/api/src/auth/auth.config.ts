// PrismaClient singleton for Better Auth adapter
// (separate from the NestJS-injected PrismaService to avoid circular deps)
let prismaForAuth: any = null;

async function getPrismaForAuth() {
  if (prismaForAuth) return prismaForAuth;

  const isWorkers = typeof globalThis?.navigator !== "undefined";

  if (isWorkers) {
    const { PrismaClient } = await import("@prisma/client");
    const { PrismaPg } = await import("@prisma/adapter-pg");
    const { Pool } = await import("pg");
    const pool = new Pool({
      connectionString: process.env["DATABASE_URL"] ?? "",
    });
    const adapter = new PrismaPg(pool);
    prismaForAuth = new PrismaClient({ adapter: adapter as any });
  } else {
    const { PrismaClient } = await import("@prisma/client");
    prismaForAuth = new PrismaClient();
  }

  return prismaForAuth;
}

export async function createAuth() {
  // Dynamic imports for ESM-only packages (better-auth is ESM-only)
  const betterAuthModule: any = await import("better-auth");
  const prismaAdapterModule: any = await import("better-auth/adapters/prisma");
  const pluginsModule: any = await import("better-auth/plugins");

  const { betterAuth } = betterAuthModule;
  const { prismaAdapter } = prismaAdapterModule;
  const { organization } = pluginsModule;

  const secret = process.env["BETTER_AUTH_SECRET"];

  if (!secret || secret.trim() === "") {
    const isWorkers = typeof globalThis?.navigator !== "undefined";
    const msg = "Missing required environment variable: BETTER_AUTH_SECRET";

    if (isWorkers) {
      throw new Error(msg);
    }

    process.stderr.write(
      JSON.stringify({
        level: "error",
        message: msg,
        variable: "BETTER_AUTH_SECRET",
        timestamp: new Date().toISOString(),
      }) + "\n",
    );
    process.exit(1);
  }

  const client = await getPrismaForAuth();

  return betterAuth({
    secret,
    database: prismaAdapter(client, {
      provider: "postgresql",
    }),
    baseURL: process.env["API_BASE_URL"] ?? "http://localhost:3001",
    basePath: "/auth",
    emailAndPassword: {
      enabled: true,
    },
    // Required so localhost (or any other site) can hold credentialed sessions against the Worker
    advanced: {
      defaultCookieAttributes: {
        sameSite: "none",
        secure: true,
      },
    },
    plugins: [
      organization({
        // Invitations expire after 7 days
        invitationExpiresIn: 60 * 60 * 24 * 7,
      }),
    ],
    // Trusted origins for CORS — supports a comma-separated FRONTEND_URL list
    trustedOrigins: (process.env["FRONTEND_URL"] ?? "http://localhost:3000")
      .split(",")
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0),
  });
}

export type Auth = Awaited<ReturnType<typeof createAuth>>;
