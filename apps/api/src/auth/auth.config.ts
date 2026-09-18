import { getSharedPrisma } from "../shared-prisma";

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
    const g = globalThis as Record<string, unknown>;
    const isWorkers =
      typeof g["WebSocketPair"] === "function" ||
      typeof globalThis?.navigator !== "undefined";
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

  const client = await getSharedPrisma();

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
      // Configure cookie prefix for cross-origin scenarios
      useSecureCookies: true,
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
