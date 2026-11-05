#!/bin/sh
# First-time setup: creates .env from .env.example with fresh random secrets.
# Safe to run again: it never overwrites an existing .env.
cd "$(dirname "$0")"
if [ -f .env ]; then
  echo ".env already exists. Edit it, then: docker compose up -d --build"
  exit 0
fi
rand() { openssl rand -hex "$1" 2>/dev/null || head -c "$1" /dev/urandom | od -An -tx1 | tr -d ' \n'; }
cp .env.example .env
sed -i.bak \
  -e "s#^AUTH_SECRET=.*#AUTH_SECRET=\"$(rand 32)\"#" \
  -e "s#^ENCRYPTION_KEY=.*#ENCRYPTION_KEY=\"$(rand 32)\"#" \
  -e "s#^POSTGRES_PASSWORD=.*#POSTGRES_PASSWORD=\"$(rand 16)\"#" \
  -e "s#^WA_VERIFY_TOKEN=.*#WA_VERIFY_TOKEN=\"$(rand 12)\"#" \
  -e "s#^CRON_SECRET=.*#CRON_SECRET=\"$(rand 16)\"#" \
  .env && rm .env.bak
chmod 600 .env
mkdir -p backups
echo "Created .env with new random secrets."
echo "Next: open .env, set APP_URL, ADMIN_EMAILS, SMTP_* and the keys you have, then run:"
echo "  docker compose up -d --build"
echo "  docker compose exec app npm run doctor     # checks every key"
echo "Back up .env somewhere safe: without ENCRYPTION_KEY the saved shop tokens cannot be read."
