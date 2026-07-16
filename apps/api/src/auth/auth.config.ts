import { PrismaClient } from "@prisma/client";

// PrismaClient singleton for Better Auth adapter
// (separate from the NestJS-injected PrismaService to avoid circular deps)
const prismaForAuth = new PrismaClient();

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
    process.stderr.write(
      JSON.stringify({
        level: "error",
        message: "Missing required environment variable: BETTER_AUTH_SECRET",
        variable: "BETTER_AUTH_SECRET",
        timestamp: new Date().toISOString(),
      }) + "\n",
    );
    process.exit(1);
  }

  return betterAuth({
    secret,
    database: prismaAdapter(prismaForAuth, {
      provider: "postgresql",
    }),
    baseURL: process.env["API_BASE_URL"] ?? "http://localhost:3001",
    basePath: "/auth",
    emailAndPassword: {
      enabled: true,
    },
    socialProviders: {
      google: {
        clientId: process.env["GOOGLE_CLIENT_ID"] ?? "",
        clientSecret: process.env["GOOGLE_CLIENT_SECRET"] ?? "",
      },
    },
    plugins: [
      organization({
        // Invitations expire after 7 days
        invitationExpiresIn: 60 * 60 * 24 * 7,
      }),
    ],
    // Trusted origins for CORS
    trustedOrigins: [
      process.env["FRONTEND_URL"] ?? "http://localhost:3000",
    ],
  });
}

export type Auth = Awaited<ReturnType<typeof createAuth>>;
