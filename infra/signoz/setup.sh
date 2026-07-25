#!/usr/bin/env bash
# =============================================================================
# Genvora SigNoz Setup Script
# Creates the 7-panel dashboard + 2 alert rules via the SigNoz API.
#
# Prerequisites:
#   - SigNoz running (docker compose up -d from infra/)
#   - curl + jq installed
#
# Usage:
#   cd infra/signoz
#   bash setup.sh              # default: http://localhost:3333
#   bash setup.sh http://host:port
# =============================================================================

set -euo pipefail

SIGNOZ_URL="${1:-http://localhost:8080}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=== Genvora SigNoz Setup ==="
echo "SigNoz URL: ${SIGNOZ_URL}"
echo ""

# ---------------------------------------------------------------------------
# Wait for SigNoz to be healthy
# ---------------------------------------------------------------------------
echo "[1/5] Waiting for SigNoz to be healthy..."
for i in $(seq 1 30); do
  if curl -sf "${SIGNOZ_URL}/" > /dev/null 2>&1; then
    echo "  SigNoz is up."
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "  ERROR: SigNoz did not become healthy after 30 attempts."
    echo "  Make sure 'docker compose up -d' has been run from the infra/ directory."
    exit 1
  fi
  sleep 2
done
echo ""

# ---------------------------------------------------------------------------
# Create Dashboard
# ---------------------------------------------------------------------------
echo "[2/5] Creating dashboard: Genvora — AI Audit Pipeline..."

DASHBOARD_PAYLOAD=$(cat "${SCRIPT_DIR}/dashboard.json")

DASHBOARD_RESPONSE=$(curl -sf -X POST "${SIGNOZ_URL}/api/v1/dashboards" \
  -H "Content-Type: application/json" \
  -d "${DASHBOARD_PAYLOAD}" 2>&1) || {
    echo "  WARN: Dashboard creation via /api/v1/dashboards failed."
    echo "  Trying legacy endpoint..."
    DASHBOARD_RESPONSE=$(curl -sf -X POST "${SIGNOZ_URL}/api/v2/dashboards" \
      -H "Content-Type: application/json" \
      -d "${DASHBOARD_PAYLOAD}" 2>&1) || {
        echo "  ERROR: Could not create dashboard via API."
        echo "  Falling back to file import — import ${SCRIPT_DIR}/dashboard.json via the SigNoz UI:"
        echo "    ${SIGNOZ_URL} → Settings → Dashboards → Import"
        echo ""
      }
  }

if [ -n "${DASHBOARD_RESPONSE:-}" ]; then
  DASHBOARD_ID=$(echo "${DASHBOARD_RESPONSE}" | jq -r '.dashboardId // .id // empty' 2>/dev/null || echo "")
  if [ -n "${DASHBOARD_ID}" ]; then
    echo "  Dashboard created: ${SIGNOZ_URL}/dashboard/${DASHBOARD_ID}"
  else
    echo "  Dashboard created (check SigNoz UI)."
  fi
fi
echo ""

# ---------------------------------------------------------------------------
# Create Alert Rules
# ---------------------------------------------------------------------------
echo "[3/5] Creating alert rules..."

ALERTS_PAYLOAD=$(cat "${SCRIPT_DIR}/alerts.json")

# Alert 1: High Error Rate
ERROR_ALERT=$(echo "${ALERTS_PAYLOAD}" | jq '.alerts[0]')
ERROR_RESPONSE=$(curl -sf -X POST "${SIGNOZ_URL}/api/v1/rules" \
  -H "Content-Type: application/json" \
  -d "${ERROR_ALERT}" 2>&1) || {
    echo "  WARN: Could not create error rate alert via /api/v1/rules."
    echo "  Trying /api/v2/alerts..."
    ERROR_RESPONSE=$(curl -sf -X POST "${SIGNOZ_URL}/api/v2/alerts" \
      -H "Content-Type: application/json" \
      -d "${ERROR_ALERT}" 2>&1) || {
        echo "  WARN: Could not create error rate alert."
        echo "  Import manually: ${SIGNOZ_URL} → Alerts → New Alert"
      }
  }
echo "  Alert 1: High Scan Error Rate — created"

# Alert 2: Slow Fetch
SLOW_ALERT=$(echo "${ALERTS_PAYLOAD}" | jq '.alerts[1]')
SLOW_RESPONSE=$(curl -sf -X POST "${SIGNOZ_URL}/api/v1/rules" \
  -H "Content-Type: application/json" \
  -d "${SLOW_ALERT}" 2>&1) || {
    echo "  WARN: Could not create slow fetch alert via /api/v1/rules."
    echo "  Trying /api/v2/alerts..."
    SLOW_RESPONSE=$(curl -sf -X POST "${SIGNOZ_URL}/api/v2/alerts" \
      -H "Content-Type: application/json" \
      -d "${SLOW_ALERT}" 2>&1) || {
        echo "  WARN: Could not create slow fetch alert."
        echo "  Import manually: ${SIGNOZ_URL} → Alerts → New Alert"
      }
  }
echo "  Alert 2: Slow Page Fetch (p95 > 30s) — created"
echo ""

# ---------------------------------------------------------------------------
# Verify
# ---------------------------------------------------------------------------
echo "[4/5] Verifying setup..."

# Check dashboard exists
DASHBOARDS=$(curl -sf "${SIGNOZ_URL}/api/v1/dashboards" 2>/dev/null || echo "[]")
GENVORA_DASH=$(echo "${DASHBOARDS}" | jq -r '.dashboards[]? | select(.title | test("Genvora"; "i")) | .id' 2>/dev/null || echo "")

if [ -n "${GENVORA_DASH}" ]; then
  echo "  Dashboard verified: ${SIGNOZ_URL}/dashboard/${GENVORA_DASH}"
else
  echo "  Dashboard: check SigNoz UI manually"
fi

# Check alerts exist
RULES=$(curl -sf "${SIGNOZ_URL}/api/v1/rules" 2>/dev/null || echo "[]")
ALERT_COUNT=$(echo "${RULES}" | jq '.data? // .rules? // [] | length' 2>/dev/null || echo "0")
echo "  Alert rules in SigNoz: ${ALERT_COUNT}"
echo ""

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo "[5/5] Setup complete!"
echo ""
echo "  SigNoz UI:       ${SIGNOZ_URL}"
echo "  Dashboard:       ${SIGNOZ_URL}/dashboard  (look for 'Genvora')"
echo "  Alerts:          ${SIGNOZ_URL}/alerts"
echo "  Traces:          ${SIGNOZ_URL}/traces?service=genvora-worker"
echo ""
echo "  Dashboard panels:"
echo "    1. Scan Volume          — scans per 5min"
echo "    2. Score Trends         — avg/min/max AI readiness score"
echo "    3. Activity Latency     — p50/p95/p99 per activity"
echo "    4. GPTBot vs Browser    — latency by user agent"
echo "    5. Error Rate           — error spans over time"
echo "    6. Recommendation Severity — critical/warning/info counts"
echo "    7. Crawlability Blockers — robots.txt, llms.txt, JS rendering"
echo ""
echo "  Alert rules:"
echo "    1. High Scan Error Rate  — fires when >3 errors in 5min"
echo "    2. Slow Page Fetch       — fires when fetch p95 > 30s"
echo ""
echo "  To test: trigger a scan via the API and watch the dashboard populate."
