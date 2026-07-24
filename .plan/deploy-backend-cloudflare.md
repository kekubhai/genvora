# Plan: Deploy Genvora Backend on Cloudflare

## Context

Genvora is a monorepo with three backend services:
- **`apps/api`** (NestJS on Express, port 3001) — Auth, health checks, scan CRUD, Temporal workflow triggering
- **`apps/worker`** (Temporal worker) — Playwright-based audit pipeline (10 activities)
- **`workers/`** (partially implemented Cloudflare Worker) — Health check + auth placeholders

The goal is to deploy the backend API to Cloudflare Workers. The Temporal worker (`apps/worker`) uses Playwright and **cannot** run on Cloudflare Workers — it stays on Docker/local.

**User decisions:**
- Frontend: Deploy via `@opennextjs/cloudflare` (OpenNext)
- API: Deploy via `@mridang/nestjs-platform-cloudflare` (NestJS Cloudflare adapter)
- Redis: Remove caching for now (ioredis incompatible with Workers)
- Temporal worker: Keep on Docker/local

**Important:** OpenNext only handles Next.js apps. The NestJS API needs its own Cloudflare adapter. Both deploy as separate Cloudflare Workers.

---

## Step 1: Update Prisma Schema for Cloudflare Compatibility

The `workers/prisma/schema.prisma` is missing `Scan`, `CategoryScore`, and `Recommendation` models. Sync it with the main schema and add `previewFeatures = ["driverAdapters"]`.

**Files:**
- `workers/prisma/schema.prisma` — Add missing models + driverAdapters preview feature
- `packages/db/prisma/schema.prisma` — Add `previewFeatures = ["driverAdapters"]` to generator

---

## Step 2: Install Dependencies

**For `apps/api` (NestJS Cloudflare adapter):**
- `@mridang/nestjs-platform-cloudflare` — NestJS HTTP adapter for Workers
- `wrangler` (devDep) — Cloudflare CLI

**For `apps/web` (OpenNext):**
- `@opennextjs/cloudflare` — Next.js → Cloudflare Workers adapter

**For `workers/` (existing, may need updates):**
- Ensure `@prisma/adapter-pg` and `@prisma/client` are current

---

## Step 3: Adapt `apps/api` for Cloudflare Workers

### 3a. Create Cloudflare entry point

Create `apps/api/src/worker.ts` — the Cloudflare Workers fetch handler that wraps the NestJS app:

```typescript
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { CloudflareAdapter } from '@mridang/nestjs-platform-cloudflare';
import { AppModule } from './app.module.js';

let app: Awaited<ReturnType<typeof NestFactory.create>> | null = null;

async function getApp() {
  if (!app) {
    const adapter = new CloudflareAdapter();
    app = await NestFactory.create(AppModule, adapter, { logger: false });
    app.enableCors({ origin: '*', credentials: true });
    await app.init();
  }
  return app;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const application = await getApp();
    return adapter.handle(request);
  },
};
```

### 3b. Remove Redis dependency

- `apps/api/src/redis/redis.module.ts` — Make it a no-op (return immediately, no Redis connection)
- `apps/api/src/redis/redis.service.ts` — Always report as degraded/unavailable
- Or remove the Redis module entirely and update `app.module.ts`

### 3c. Remove Sentry (or make it optional)

- `apps/api/src/instrument.ts` — Already handles missing DSN gracefully (no-op mode)
- No changes needed, but `@sentry/node` may not bundle cleanly for Workers

### 3d. Handle Temporal client

- `apps/api/src/scans/scans.service.ts` — Already handles missing `TEMPORAL_ADDRESS` gracefully
- The Temporal client is lazy-initialized and optional

### 3e. Create `wrangler.toml` for `apps/api`

```toml
name = "genvora-api"
main = "src/worker.ts"
compatibility_date = "2024-01-01"
compatibility_flags = ["nodejs_compat"]

[vars]
ENVIRONMENT = "production"
```

### 3f. Handle Better Auth for Workers

The current `auth.config.ts` creates a standalone `PrismaClient`. For Workers:
- Use `@prisma/adapter-pg` instead of the default Prisma engine
- Create the Prisma client per-request or use a singleton with the PG adapter
- Better Auth's Prisma adapter should work with the PG adapter

---

## Step 4: Configure OpenNext for `apps/web`

### 4a. Install and configure

- Add `@opennextjs/cloudflare` to `apps/web`
- Create `apps/web/worker.ts` (OpenNext entry point)
- Update `apps/web/wrangler.toml` with OpenNext config
- Remove `apps/web/vercel.json` (replaced by wrangler.toml)

### 4b. Update `apps/web/next.config.mjs`

- Remove `@sentry/nextjs` wrapping (or use `@opennextjs/sentry` if available)
- Ensure `transpilePackages` includes `@repo/shared-types`

### 4c. Update frontend env vars

- `NEXT_PUBLIC_API_URL` → points to the deployed Cloudflare API Worker URL
- Add `wrangler.toml` with proper vars

---

## Step 5: Update Turborepo Pipeline

Update `turbo.json` and root `package.json` with Cloudflare-specific tasks:

- `cf:typegen` — Generate Cloudflare Worker types
- `cf:dev` — Run wrangler dev for API and/or frontend
- `cf:deploy` — Deploy to Cloudflare
- `cf:deploy:api` — Deploy API Worker only
- `cf:deploy:web` — Deploy frontend Worker only

---

## Step 6: Clean Up `workers/` Directory

The existing `workers/` directory has a partial implementation that overlaps with what we're building in `apps/api`. Options:
- **Delete `workers/`** — The functionality is now in `apps/api/src/worker.ts`
- **Keep as reference** — But it will be stale

Recommended: Delete the `workers/` directory to avoid confusion, since `apps/api` becomes the Cloudflare API Worker.

---

## Step 7: Environment Variables & Secrets

### Required Cloudflare secrets for API Worker:
```
DATABASE_URL          — Supabase direct connection (not pooled)
BETTER_AUTH_SECRET    — Session signing secret
SUPABASE_URL          — Supabase project URL
SUPABASE_SERVICE_ROLE_KEY — For storage uploads
```

### Required Cloudflare vars for frontend Worker:
```
NEXT_PUBLIC_API_URL   — Deployed API Worker URL
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
```

---

## Step 8: Deployment Commands

```bash
# Deploy API
cd apps/api && npx wrangler deploy

# Deploy frontend
cd apps/web && npx @opennextjs/cloudflare build && npx wrangler deploy

# Or via root scripts
npm run cf:deploy:api
npm run cf:deploy:web
```

---

## Verification

1. **Local dev**: `wrangler dev` in `apps/api` — verify health endpoint responds
2. **Auth flow**: Test sign-in/sign-up against Cloudflare-deployed API
3. **Scan CRUD**: Test creating and listing scans
4. **Frontend**: Verify Next.js app loads and connects to API
5. **Database**: Verify Prisma + PG adapter connects to Supabase from Workers
6. **Temporal**: Verify scan creation still triggers Temporal workflows (worker runs locally)

---

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| NestJS bundle too large for Workers (3MB free limit) | Use `nodejs_compat` flag; consider Hono rewrite if bundle exceeds limit |
| Better Auth + Prisma PG adapter compatibility | Test locally with `wrangler dev` before deploying |
| Cold start latency with NestJS | Cloudflare adapter avoids Express overhead; singleton app pattern |
| `@sentry/node` bundling issues | Already in no-op mode; remove dependency if it causes build failures |
| `reflect-metadata` bundle size | Required by NestJS decorators; cannot be removed |
