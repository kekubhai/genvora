# SigNoz (Foundry)

Genvora ships a **reproducible** SigNoz stack via [Foundry](https://github.com/SigNoz/foundry).

## Files judges re-run

| File | Purpose |
|------|---------|
| `casting.yaml` | Declarative install (Compose + MCP) |
| `casting.yaml.lock` | Locked, fully-resolved casting |
| `pours/` | Generated Compose + configs (`foundryctl forge`) |

## Deploy

Requires Docker Engine 20.10+ and Compose v2. On Windows, use **WSL 2** with Docker (ClickHouse Keeper can segfault under Docker Desktop alone).

```bash
# 1. Install foundryctl
curl -fsSL https://signoz.io/foundry.sh | bash
export PATH="$HOME/.local/bin:$PATH"

# 2. From repo root — validate, generate, start
foundryctl cast -f casting.yaml
```

Or step-by-step:

```bash
foundryctl gauge -f casting.yaml
foundryctl forge -f casting.yaml
cd pours/deployment && docker compose up -d
```

## Endpoints

| Service | URL |
|---------|-----|
| SigNoz UI | http://localhost:8080 |
| OTLP gRPC | localhost:4317 |
| OTLP HTTP | localhost:4318 |
| MCP server | http://localhost:8000 |

## App wiring

The Temporal worker (`apps/worker`) initializes OpenTelemetry as service `genvora-worker` and exports to `OTEL_EXPORTER_OTLP_ENDPOINT` (default `http://localhost:4317`).

```bash
# root .env
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317
NEXT_PUBLIC_SIGNOZ_URL=http://localhost:8080
```

Start infra + worker:

```bash
# Temporal / Redis / Postgres (no SigNoz here — Foundry owns that)
cd infra && docker compose up -d

# Worker → Temporal → OTEL → SigNoz
npm run dev --workspace=@repo/worker
```

## Dashboard + alerts

```bash
bash infra/signoz/setup.sh http://localhost:8080
```

Imports the Genvora audit-pipeline dashboard and alert rules.

## MCP (AI clients)

1. Open http://localhost:8080 → Settings → Service Accounts → create API key (Admin).
2. Point your MCP client at `http://localhost:8000/mcp` with header `SIGNOZ-API-KEY: <key>`.

**Cursor** (`~/.cursor/mcp.json`):

```json
"signoz": {
  "url": "http://localhost:8000/mcp",
  "headers": {
    "SIGNOZ-API-KEY": "<your-api-key>"
  }
}
```

Then reload MCP / restart Cursor. Keep the key out of git (use root `.env` `SIGNOZ_API_KEY`).

```bash
curl -fsS http://localhost:8000/livez && echo OK
```
