import "reflect-metadata";
import type { ExecutionContext } from "@cloudflare/workers-types";

let adapter: any = null;
let app: any = null;
let auth: any = null;

export interface Env {
  DATABASE_URL: string;
  DIRECT_DATABASE_URL?: string;
  BETTER_AUTH_SECRET: string;
  ENVIRONMENT?: string;
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  FRONTEND_URL?: string;
  API_BASE_URL?: string;
  REDIS_URL?: string;
  TEMPORAL_ADDRESS?: string;
  SENTRY_DSN?: string;
  LLM_PROVIDER?: string;
  LLM_MODEL?: string;
  OPENAI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  GEMINI_API_KEY?: string;
  PERPLEXITY_API_KEY?: string;
}

function applyEnv(env: Env) {
  for (const [key, value] of Object.entries(env)) {
    if (typeof value === "string") {
      process.env[key] = value;
    }
  }
  process.env["DIRECT_DATABASE_URL"] ??= process.env["DATABASE_URL"];
}

function getAllowedOrigins(env: Env): string[] {
  return (env.FRONTEND_URL ?? "http://localhost:3000")
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

function corsHeaders(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get("Origin") ?? "";
  const allowed = getAllowedOrigins(env);
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers":
      request.headers.get("Access-Control-Request-Headers") ?? "Content-Type, Authorization",
    "Access-Control-Allow-Credentials": "true",
    Vary: "Origin",
  };

  if (origin && allowed.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  return headers;
}

async function getApplication(env: Env) {
  if (!app) {
    applyEnv(env);

    const { NestFactory } = await import("@nestjs/core");
    const { CloudflareAdapter } = await import("@mridang/nestjs-platform-cloudflare");
    const { AppModule } = await import("./app.module.js");

    adapter = new CloudflareAdapter();
    app = await NestFactory.create(AppModule, adapter, {
      logger: ["error", "warn", "log"],
    });

    app.enableCors({
      // Must be an array — Nest treats a comma-separated string as one origin
      origin: getAllowedOrigins(env),
      credentials: true,
    });

    await app.init();
  }
  return app;
}

async function getAuth(env: Env) {
  if (!auth) {
    applyEnv(env);

    const { createAuth } = await import("./auth/auth.config.js");
    auth = await createAuth();
  }

  return auth;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      const cors = corsHeaders(request, env);
      if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: cors });
      }
      return Response.json(
        {
          status: "ok",
          environment: env.ENVIRONMENT ?? "production",
        },
        { headers: cors },
      );
    }

    if (url.pathname === "/auth" || url.pathname.startsWith("/auth/")) {
      const cors = corsHeaders(request, env);

      // Handle CORS preflight requests before hitting Better Auth
      if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: cors });
      }

      const authInstance = await getAuth(env);
      const response: Response = await authInstance.handler(request);

      // Ensure CORS headers are present on the auth response
      const headers = new Headers(response.headers);
      for (const [key, value] of Object.entries(cors)) {
        headers.set(key, value);
      }

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }

    await getApplication(env);
    return adapter.handle(request);
  },
};
