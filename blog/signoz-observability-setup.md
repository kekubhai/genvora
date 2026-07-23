# Self-Hosting SigNoz in a Turborepo: From Zero to First Trace in an Afternoon

**TL;DR:** We added full distributed tracing to our Temporal-based audit pipeline using self-hosted SigNoz + OpenTelemetry. 9 activities, 50+ span attributes, one `docker compose up`. Here's exactly how.

---

## Why Self-Hosted Observability

Genvora is an AI readiness audit platform. A user triggers a scan, our Temporal worker crawls their site with Playwright, parses HTML with Cheerio, scores it against 5 categories, generates recommendations, and stores snapshots. Nine activities, ~30 seconds of wall time.

We had Sentry for error capturing and PostHog for product analytics, but zero visibility into *what was actually happening* during a scan. Which activity was slow? Did the Playwright browser launch succeed? How many images were missing alt text? We were flying blind.

SigNoz gives us traces, metrics, and logs in one self-hosted stack backed by ClickHouse. No per-seat pricing, no data leaving our infrastructure, and it runs on a single `docker compose up`.

---

## The Architecture

```
┌─────────────────┐     OTLP gRPC      ┌──────────────────┐
│  genvora-worker  │ ──────────────────▶ │  SigNoz Standalone │
│  (Temporal)      │                     │  ┌──────────────┐ │
│                  │                     │  │ OTel Collector│ │
│  initTracer()    │                     │  ├──────────────┤ │
│  9 instrumented  │                     │  │ ClickHouse   │ │
│  activities      │                     │  ├──────────────┤ │
└─────────────────┘                     │  │ SigNoz UI    │ │
                                        │  └──────────────┘ │
                                        └──────────────────┘
                                              :3333 (UI)
                                              :4317 (OTLP)
```

The `signoz/signoz-standalone` image bundles everything — ClickHouse for storage, the OTel Collector for ingestion, and the SigNoz query service + frontend. One container, one volume, done.

---

## Step 1: Docker Compose

We appended SigNoz to our existing `infra/docker-compose.yml` (which already had Postgres, Redis, and Temporal):

```yaml
signoz:
  image: signoz/signoz-standalone:latest
  container_name: genvora-signoz
  restart: unless-stopped
  privileged: true
  ports:
    - "3333:8080"   # SigNoz UI (remapped to avoid conflicts)
    - "4317:4317"   # OTLP gRPC
    - "4318:4318"   # OTLP HTTP
  volumes:
    - signoz_clickhouse:/var/lib/clickhouse
    - signoz_data:/var/lib/signoz
  healthcheck:
    test: ["CMD", "wget", "--spider", "-q", "http://localhost:8080/"]
    interval: 15s
    timeout: 5s
    retries: 10
    start_period: 30s
```

`privileged: true` is required by the standalone image for ClickHouse. The `start_period: 30s` gives ClickHouse time to initialize before health checks kick in.

---

## Step 2: The `@repo/observability` Package

We created a shared package at `packages/observability` that any app in the monorepo can import:

```typescript
// packages/observability/src/tracer.ts
import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-grpc";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { PrismaInstrumentation } from "@prisma/instrumentation";

export function initTracer(serviceName: string) {
  const endpoint = process.env["OTEL_EXPORTER_OTLP_ENDPOINT"] ?? "http://localhost:4317";

  const sdk = new NodeSDK({
    traceExporter: new OTLPTraceExporter({ url: endpoint }),
    instrumentations: [
      getNodeAutoInstrumentations({
        "@opentelemetry/instrumentation-fs": { enabled: false },
      }),
      new PrismaInstrumentation(),
    ],
  });

  sdk.start();
  // Graceful shutdown on SIGTERM/SIGINT
}
```

Key decisions:
- **`auto-instrumentations-node`** hooks `http`, `dns`, `express`, and every `require()` call automatically. This catches Temporal client connections, Supabase API calls, and Playwright's network requests without touching application code.
- **`PrismaInstrumentation`** adds database query spans with timing.
- **FS instrumentation disabled** because it generates thousands of noisy spans per file read.
- **gRPC exporter** (not HTTP) because it's faster and the OTel Collector defaults to it.

---

## Step 3: Wiring Into the Worker

The critical detail: `initTracer()` must be the **very first import** in `apps/worker/src/index.ts`. Auto-instrumentations work by monkey-patching `require()` and `http.request()` — they need to run before any other module loads.

```typescript
// apps/worker/src/index.ts
import { initTracer } from "@repo/observability";
initTracer("genvora-worker");  // ← FIRST line

// Everything else comes after
import { NativeConnection, Worker } from "@temporalio/worker";
import { TASK_QUEUES } from "@repo/shared-types";
// ...
```

If you call `initTracer()` after importing Temporal or Playwright, those modules' HTTP clients won't be instrumented. The order matters.

---

## Step 4: Instrumenting the Activities (The Real Work)

Auto-instrumentation gives you generic `http.GET` and `dns.lookup` spans. Useful, but not what you need when debugging "why did this scan take 45 seconds?" We wrapped each of our 9 activities in named spans with domain-specific attributes.

### fetchPageActivity

```typescript
return tracer.startActiveSpan("activity.fetch_page", async (span) => {
  span.setAttribute("url.target", url);
  span.setAttribute("user_agent.selected", randomUA);
  // ... Playwright crawl logic ...
  span.setAttribute("http.status_code", statusCode);
  span.setAttribute("url.redirected", finalUrl !== url);
  span.setAttribute("html.raw_bytes", rawHtml.length);
  span.setAttribute("screenshot.bytes", screenshot.length);
  span.setAttribute("robots_txt.found", !!robotsTxt);
  span.setAttribute("llms_txt.found", !!llmsTxt);
  span.setAttribute("http.load_time_ms", loadTime);
  span.end();
  return result;
});
```

### parseStructureActivity

```typescript
span.setAttribute("headings.total", headingHierarchy.length);
span.setAttribute("headings.max_level", maxHeadingLevel);
span.setAttribute("schema_org.found", hasSchemaOrg);
span.setAttribute("semantic.html_ratio", semanticHtmlRatio);
span.setAttribute("images.alt_text_coverage", altTextCoverage);
span.setAttribute("links.internal", internalLinkCount);
```

### scoreActivity

```typescript
span.setAttribute("score.overall", result.overallScore);
for (const [category, scoreVal] of Object.entries(result.categoryScores)) {
  span.setAttribute(`score.category.${category}`, scoreVal);
}
span.setAttribute("score.grade", grade);  // A/B/C/D/F
```

### generateRecommendationsActivity

```typescript
span.setAttribute("recommendations.total", recommendations.length);
span.setAttribute("recommendations.critical", criticalCount);
span.setAttribute("recommendations.warning", warningCount);
span.setAttribute("recommendations.titles", recommendations.map(r => r.title).join("; "));
```

Every activity follows the same pattern:
1. `tracer.startActiveSpan("activity.name", async (span) => { ... })`
2. Set attributes before, during, and after the work
3. `span.end()` before returning

The span names use `activity.` prefix to distinguish from auto-instrumented spans. Attributes use dot notation (`score.overall`, `robots_txt.found`) which SigNoz renders as filterable columns.

---

## What the Traces Look Like

In SigNoz, navigate to **Services → genvora-worker → Traces**. Each scan produces a trace like:

```
activity.fetch_page (12.3s)
├── url.target: https://example.com
├── user_agent.selected: GPTBot/1.0
├── http.status_code: 200
├── html.raw_bytes: 48392
├── robots_txt.found: true
└── http.load_time_ms: 12340

activity.parse_structure (45ms)
├── headings.total: 12
├── schema_org.found: false
├── semantic.html_ratio: 0.34
└── images.alt_text_coverage: 0.67

activity.check_crawlability (12ms)
├── robots_txt.allows_ai: true
├── llms_txt.present: false
└── js_rendering.required: false

activity.score (2ms)
├── score.overall: 62
├── score.category.structure: 55
├── score.category.crawlability: 78
└── score.grade: D

activity.generate_recommendations (1ms)
├── recommendations.total: 6
├── recommendations.critical: 2
└── recommendations.warning: 4

activity.store_snapshot (890ms)
├── snapshot.html_upload.success: true
└── snapshot.screenshot_upload.success: true
```

Now when a user says "my scan was slow," you can immediately see it was `fetch_page` taking 12 seconds because their server is slow to respond. When scores look wrong, you can verify the raw analysis data in the span attributes. When uploads fail, the error is right there in the span status.

---

## Lessons Learned

### 1. `initTracer()` order is everything
If you import `@temporalio/worker` before calling `initTracer()`, Temporal's HTTP connections won't be instrumented. We lost an hour to this.

### 2. Version pinning matters in OTel
`@opentelemetry/sdk-node` bundles its own `@opentelemetry/sdk-metrics` and `@opentelemetry/resources`. If you also install those as direct dependencies at different versions, you get type conflicts. Let `sdk-node` manage its transitive deps.

### 3. Span attributes > log statements
Instead of `console.log("Fetched page in ${loadTime}ms")`, put it in a span attribute. Logs are unstructured text you grep through. Span attributes are structured, filterable, and correlated with the trace timeline.

### 4. The `activity.` prefix saves you
Without it, your custom spans get buried among auto-instrumented `http.GET` spans. The prefix makes them instantly searchable in SigNoz.

### 5. Error spans > thrown errors
When an activity fails, set `span.setStatus({ code: SpanStatusCode.ERROR, message })` before throwing. The span shows up red in the timeline and the error is captured in the trace without needing to cross-reference logs.

---

## What's Next

- **Log correlation:** Pipe Winston/Pino logs through the OTel Collector so logs and traces share the same trace ID
- **Metrics:** Custom counters for scan success/failure rates, histogram for activity durations
- **Dashboards:** SigNoz dashboards for scan latency percentiles, error rates by activity
- **Alerting:** Alert when `fetch_page` p99 exceeds 30s or `score.overall` drops below 50

---

## Running It

```bash
# Start SigNoz + infrastructure
cd infra && docker compose up -d

# Build and start the worker
cd .. && npm run build
cd apps/worker && npm run dev

# Trigger a scan (via API or test script)
curl -X POST http://localhost:3001/sites/<siteId>/scans

# Open SigNoz
open http://localhost:3333
# → Services → genvora-worker → Traces
```

Total time from `docker compose up` to first trace showing in the UI: ~5 minutes (most of that is ClickHouse initialization).

---

*This is Phase 1 of our observability rollout for Genvora. Next up: metrics, dashboards, and alerting before we go live.*
