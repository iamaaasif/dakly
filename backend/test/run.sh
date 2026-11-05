#!/bin/sh
# Runs the full end-to-end test suite against a throwaway stack where every outside
# provider (OpenAI, WhatsApp, Twilio, SMS, SSLCommerz, Stripe, Facebook, Shopify, WooCommerce, SMTP)
# is replaced by test/mock/server.mjs. Nothing real is sent or charged.
#   sh test/run.sh            API tests (needs Docker + Node 20+, and `npm ci` once for exceljs)
#   WEB=1 sh test/run.sh      also the browser tests (needs Playwright with Chromium)
set -e
cd "$(dirname "$0")/.."
sh test/mock/gen-certs.sh
COMPOSE=${COMPOSE:-"docker compose -p dakly-test -f docker-compose.yml -f test/docker-compose.test.yml"}
export COMPOSE
$COMPOSE down -v >/dev/null 2>&1 || true
$COMPOSE up -d --build db mock app
echo "Waiting for Dakly..."
i=0; until curl -sf http://localhost:3000/api/health >/dev/null; do i=$((i+1)); [ $i -gt 90 ] && { $COMPOSE logs app | tail -50; exit 1; }; sleep 2; done
sleep 4
status=0
node test/e2e-api.mjs || status=1
if [ -n "$WEB" ]; then node test/e2e-web.mjs || status=1; fi
node test/report.mjs || true
[ -n "$KEEP" ] || $COMPOSE down -v >/dev/null 2>&1
exit $status
