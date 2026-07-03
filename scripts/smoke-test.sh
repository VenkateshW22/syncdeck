#!/usr/bin/env bash
# -----------------------------------------------------------------------
# scripts/smoke-test.sh
#
# Post-deploy health check. Polls the app's /api/v1/health endpoint
# until it returns HTTP 200 with a valid JSON body, or times out.
#
# Usage:
#   ./scripts/smoke-test.sh                          # default: http://localhost:80
#   ./scripts/smoke-test.sh http://staging.host.com  # custom base URL
#   ./scripts/smoke-test.sh http://localhost:3000     # direct to app (no nginx)
#
# Exit codes:
#   0 — health check passed
#   1 — timed out or unhealthy response
# -----------------------------------------------------------------------

set -euo pipefail

BASE_URL="${1:-http://localhost:80}"
HEALTH_URL="${BASE_URL}/api/v1/health"
TIMEOUT="${SMOKE_TIMEOUT:-60}"   # seconds; override with SMOKE_TIMEOUT env var
INTERVAL=3

echo "🔍 SyncDeck Smoke Test"
echo "   Target : $HEALTH_URL"
echo "   Timeout: ${TIMEOUT}s"
echo ""

elapsed=0
success=false

while [ "$elapsed" -lt "$TIMEOUT" ]; do
  # Try the health endpoint — capture both HTTP status code and body
  response=$(curl -s -w "\n%{http_code}" --max-time 5 "$HEALTH_URL" 2>/dev/null || true)
  body=$(echo "$response" | sed '$d')
  status=$(echo "$response" | tail -n 1)

  if [ "$status" = "200" ] && echo "$body" | grep -q '"status"'; then
    success=true
    break
  fi

  echo "  ⏳ Not ready yet (HTTP ${status:-000}, ${elapsed}s elapsed)..."
  sleep "$INTERVAL"
  elapsed=$((elapsed + INTERVAL))
done

echo ""

if [ "$success" = "true" ]; then
  echo "✅ Health check passed!"
  echo "   Response: $body"
  echo ""

  # Optional: verify key fields
  if echo "$body" | grep -q '"db"'; then
    db_status=$(echo "$body" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('db','unknown'))" 2>/dev/null || echo "unknown")
    echo "   DB status : $db_status"
  fi
  if echo "$body" | grep -q '"redis"'; then
    redis_status=$(echo "$body" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('redis','unknown'))" 2>/dev/null || echo "unknown")
    echo "   Redis status: $redis_status"
  fi

  exit 0
else
  echo "❌ Smoke test FAILED — app did not respond within ${TIMEOUT}s"
  echo "   Last HTTP status : ${status:-000}"
  echo "   Last body        : ${body:-<empty>}"
  echo ""
  echo "   Troubleshooting tips:"
  echo "   - docker compose -f docker-compose.staging.yml logs syncdeck"
  echo "   - docker compose -f docker-compose.staging.yml logs migrate"
  echo "   - docker compose -f docker-compose.staging.yml ps"
  exit 1
fi
