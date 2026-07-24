import "reflect-metadata";
import type { ExecutionContext } from "@cloudflare/workers-types";

let adapter: any = null;
let app: any = null;

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
      origin: process.env["FRONTEND_URL"] ?? "*",
      credentials: true,
    });

    await app.init();
  }
  return app;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    await getApplication(env);
    return adapter.handle(request);
  },
};
