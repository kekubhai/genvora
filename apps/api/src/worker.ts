import "reflect-metadata";
import type { ExecutionContext } from "@cloudflare/workers-types";
import { handleSitesAndScans } from "./cf-routes";

let adapter: any = null;
let app: any = null;
let auth: any = null;
let appInit: Promise<any> | null = null;
let authInit: Promise<any> | null = null;

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
      request.headers.get("Access-Control-Request-Headers") ??
      "Content-Type, Authorization",
    "Access-Control-Allow-Credentials": "true",
    Vary: "Origin",
  };

  if (origin && allowed.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  } else if (!origin) {
    // Non-browser clients
    headers["Access-Control-Allow-Origin"] = allowed[0] ?? "*";
  }

  return headers;
}

function withCors(response: Response, cors: Record<string, string>): Response {
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

async function getApplication(env: Env) {
  if (app) return app;

  if (!appInit) {
    appInit = (async () => {
      applyEnv(env);

      const { NestFactory } = await import("@nestjs/core");
      const { CloudflareAdapter } = await import("@mridang/nestjs-platform-cloudflare");
      const { AppModule } = await import("./app.module.js");

      adapter = new CloudflareAdapter();
      const nestApp = await NestFactory.create(AppModule, adapter, {
        logger: ["error", "warn", "log"],
      });

      nestApp.enableCors({
        origin: getAllowedOrigins(env),
        credentials: true,
      });

      await nestApp.init();
      app = nestApp;
      return nestApp;
    })().catch((err) => {
      appInit = null;
      throw err;
    });
  }

  return appInit;
}

async function getAuth(env: Env) {
  if (auth) return auth;

  if (!authInit) {
    authInit = (async () => {
      applyEnv(env);
      const { createAuth } = await import("./auth/auth.config.js");
      auth = await createAuth();
      return auth;
    })().catch((err) => {
      authInit = null;
      throw err;
    });
  }

  return authInit;
}

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const cors = corsHeaders(request, env);

    try {
      applyEnv(env);

      // Always answer CORS preflight without touching Nest/Prisma
      if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: cors });
      }

      if (url.pathname === "/health") {
        return Response.json(
          {
            status: "ok",
            environment: env.ENVIRONMENT ?? "production",
          },
          { headers: cors },
        );
      }

      if (url.pathname === "/auth" || url.pathname.startsWith("/auth/")) {
        const authInstance = await getAuth(env);
        const response: Response = await authInstance.handler(request);
        return withCors(response, cors);
      }

      // Fast path: sites + scans without Nest (avoids cold-start hangs)
      const fast = await handleSitesAndScans(request, cors);
      if (fast) return fast;

      // Fallback: remaining Nest routes
      await getApplication(env);
      const response = await adapter.handle(request);
      return withCors(response, cors);
    } catch (err) {
      return Response.json(
        {
          error: err instanceof Error ? err.message : "Internal server error",
        },
        { status: 500, headers: cors },
      );
    }
  },
};
