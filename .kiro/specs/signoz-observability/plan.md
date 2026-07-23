# Phase 1 — SigNoz Self-Host + Minimal Trace Proof

## Context

Genvora is a monorepo (turborepo) with `apps/worker` running a 9-activity Temporal audit pipeline (Playwright crawl → Cheerio parse → scoring). Currently zero OpenTelemetry instrumentation — only Sentry for error capturing and PostHog for analytics. The goal is to self-host SigNoz via Docker Compose, wire a shared `@repo/observability` package into the worker, and confirm one real trace appears when a scan is triggered. A blog post will be written based on this work.

---

## Step 1 — Add SigNoz + OTel Collector to `infra/docker-compose.yml`

**Files:** `infra/docker-compose.yml`

Append three new services to the existing compose file (postgres, redis, temporal stay untouched):

```yaml
  signoz-otel-collector:
    image: signoz/signoz-otel-collector:0.111.204
    container_name: genvora-otel-collector
    command: ["--config=/etc/otel-collector-config.yaml"]
    volumes:
      - ./otel-collector-config.yaml:/etc/otel-collector-config.yaml
    ports:
      - "4317:4317"   # OTLP gRPC
      - "4318:4318"   # OTLP HTTP
    depends_on:
      - clickhouse
      - clickhouse-schema-init

  clickhouse:
    image: clickhouse/clickhouse-server:24.3-alpine
    container_name: genvora-clickhouse
    environment:
      CLICKHOUSE_DB: signoz
      CLICKHOUSE_USER: clickhouse
      CLICKHOUSE_PASSWORD: clickhouse
    volumes:
      - clickhouse_data:/var/lib/clickhouse
    ports:
      - "8123:8123"
      - "9000:9000"

  clickhouse-schema-init:
    image: clickhouse/clickhouse-server:24.3-alpine
    container_name: genvora-clickhouse-init
    depends_on:
      - clickhouse
    volumes:
      - ./clickhouse-init.sql:/docker-entrypoint-initdb.d/init.sql
    entrypoint: >
      /bin/sh -c "clickhouse-client --host clickhouse --user clickhouse --password clickhouse --multiquery < /docker-entrypoint-initdb.d/init.sql"

  signoz-query-service:
    image: signoz/query-service:0.111.204
    container_name: genvora-query-service
    command: ["--config=/root/config/prometheus.yml"]
    volumes:
      - ./signoz-query-config.yaml:/root/config/prometheus.yml
    ports:
      - "8080:8080"
    depends_on:
      - clickhouse
      - signoz-otel-collector

  signoz-frontend:
    image: signoz/frontend:0.111.204
    container_name: genvora-signoz-frontend
    ports:
      - "3333:3333"
    depends_on:
      - signoz-query-service
```

**Also create these config files in `infra/`:**
- `infra/otel-collector-config.yaml` — minimal OTLP receiver + ClickHouse exporter
- `infra/clickhouse-init.sql` — SigNoz schema (copy from SigNoz quickstart)
- `infra/signoz-query-config.yaml` — query-service pointing at ClickHouse

---

## Step 2 — Create `packages/observability`

**New files:**
- `packages/observability/package.json`
- `packages/observability/tsconfig.json`
- `packages/observability/src/index.ts`
- `packages/observability/src/tracer.ts`

The package exports:

```ts
// packages/observability/src/tracer.ts
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-grpc";
import { Resource } from "@opentelemetry/resources";
import { SEMRESATTRS_SERVICE_NAME } from "@opentelemetry/semantic-conventions";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { PrismaInstrumentation } from "@prisma/instrumentation";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";

export function initTracer(serviceName: string) {
  const provider = new NodeTracerProvider({
    resource: new Resource({
      [SEMRESATTRS_SERVICE_NAME]: serviceName,
    }),
  });

  const exporter = new OTLPTraceExporter({
    url: process.env["OTEL_EXPORTER_OTLP_ENDPOINT"] ?? "http://localhost:4317",
  });

  provider.addSpanProcessor(new BatchSpanProcessor(exporter));
  provider.register();

  // Auto-instrument HTTP, DNS, Express, etc.
  // Prisma instrumentation adds DB spans automatically
}
```

**Dependencies to install:**
- `@opentelemetry/sdk-trace-node`
- `@opentelemetry/sdk-trace-base`
- `@opentelemetry/exporter-trace-otlp-grpc`
- `@opentelemetry/resources`
- `@opentelemetry/semantic-conventions`
- `@opentelemetry/auto-instrumentations-node`
- `@prisma/instrumentation`

**Root workspace:** Add `"packages/*"` is already covered. Add to `turbo.json` a `build` task for the observability package (inherits existing default).

---

## Step 3 — Wire `@repo/observability` into `apps/worker`

**Files:** `apps/worker/src/index.ts`, `apps/worker/package.json`

1. Add `"@repo/observability": "*"` to worker dependencies.
2. At the very top of `apps/worker/src/index.ts` (before any other import):

```ts
import { initTracer } from "@repo/observability";
initTracer("genvora-worker");
```

This must be the first line so `auto-instrumentations-node` hooks `require()` for all subsequent modules (playwright, cheerio, @temporalio/*, @supabase/*, prisma).

3. Add `OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317` to `.env.example`.

---

## Step 4 — Add env vars to `.env.example` and `.env`

**File:** `.env.example`

Add under the OBSERVABILITY section:

```
# OpenTelemetry — SigNoz collector endpoint
OTEL_EXPORTER_OTLP_ENDPOINT="http://localhost:4317"
```

---

## Step 5 — Smoke Test: Trigger a Scan, Confirm Trace in SigNoz

Manual verification steps (not automated):

1. `cd infra && docker compose up -d` — brings up postgres, redis, temporal, clickhouse, otel-collector, signoz-query-service, signoz-frontend
2. `cd ../.. && npm run build` — builds all packages including observability
3. Start the worker: `cd apps/worker && npm run dev`
4. From the API or a test script, trigger a scan on any URL via `POST /sites/:siteId/scans`
5. Open SigNoz UI at `http://localhost:3333`
6. Navigate to `Services → genvora-worker → Traces` — confirm at least one `AuditWorkflow` trace appears with child spans for each activity

---

## Step 6 — Write the Pre-Event Blog Post

**New file:** `blog/signoz-observability-setup.md`

Title: "Self-Hosting SigNoz in a Turborepo: Observability from Zero to First Trace"

Sections:
1. Why we chose SigNoz over SaaS (cost, data ownership, self-hosted for hackathon)
2. Docker Compose architecture — ClickHouse + OTel Collector + Query Service + Frontend
3. The `@repo/observability` package — shared tracer with auto-instrumentations
4. Wiring into the Temporal worker — why init order matters
5. What the first trace looks like — a Temporal workflow with 9 activity spans
6. What's next: metrics, logs, alerting

---

## Verification

After all changes:
1. `npm run typecheck` from root — must pass with no errors
2. `docker compose -f infra/docker-compose.yml config` — validates compose syntax
3. `docker compose -f infra/docker-compose.yml up -d` — all services start (clickhouse healthcheck passes)
4. Worker starts without crash, `initTracer` logs connection to collector
5. Trigger scan → open `http://localhost:3333` → traces tab shows `genvora-worker` service with `AuditWorkflow` trace

---

## Scope Boundaries

- **In scope:** SigNoz compose, observability package, worker instrumentation, blog post
- **Out of scope:** API instrumentation, log correlation, dashboard creation, alerting, production deployment
- **No changes to:** workflows, activities, API, web, Cloudflare Workers, database schema
