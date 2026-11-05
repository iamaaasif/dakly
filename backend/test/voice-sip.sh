#!/bin/sh
# AI voice call test over a SIP trunk: the real Dakly app and its Asterisk container call a fake
# IPCallBD (another Asterisk) that answers, presses keys, is busy or never answers, and records
# what it hears. Nothing leaves the machine.
#   sh test/voice-sip.sh          (needs Docker + Node 20+)
#   KEEP=1 sh test/voice-sip.sh   leave the stack running afterwards
set -e
cd "$(dirname "$0")/.."
sh test/mock/gen-certs.sh
COMPOSE=${COMPOSE:-"docker compose -p dakly-voice -f docker-compose.yml -f test/docker-compose.test.yml -f compose.asterisk.yml -f test/docker-compose.voice.yml"}
export COMPOSE
$COMPOSE down -v >/dev/null 2>&1 || true
rm -rf test/results/voice-rec && mkdir -p test/results/voice-rec
$COMPOSE up -d --build db mock app fake-ipcallbd asterisk
echo "Waiting for Dakly..."
i=0; until curl -sf http://localhost:3000/api/health >/dev/null; do i=$((i+1)); [ $i -gt 90 ] && { $COMPOSE logs app | tail -50; exit 1; }; sleep 2; done
echo "Waiting for Asterisk to register with the fake trunk..."
i=0; until $COMPOSE exec -T asterisk asterisk -rx "pjsip show registrations" 2>/dev/null | grep -q Registered; do i=$((i+1)); [ $i -gt 30 ] && { $COMPOSE logs asterisk | tail -50; exit 1; }; sleep 2; done
status=0
node test/e2e-voice.mjs || status=1
[ $status -eq 0 ] || $COMPOSE logs asterisk | grep -v "declined to load" | tail -80
[ -n "$KEEP" ] || $COMPOSE down -v >/dev/null 2>&1
exit $status
