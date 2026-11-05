#!/usr/bin/env bash
# Dakly one-command server install (Ubuntu/Debian, run as root or with sudo).
#   sudo bash install.sh
# It installs Docker, gets the code with a read-only GitHub deploy key, creates .env
# with fresh secrets, checks DNS, starts Dakly behind Caddy (free HTTPS) and checks
# https://DOMAIN/api/health. Safe to run again: it updates the code and keeps .env.
set -euo pipefail

REPO="git@github.com:iamaaasif/dakly.git"
BRANCH="${DAKLY_BRANCH:-main}"
DIR="${DAKLY_DIR:-/opt/dakly}"
KEY=/root/.ssh/dakly_deploy

[ "$(id -u)" = 0 ] || { echo "Run as root: sudo bash $0"; exit 1; }
say() { printf '\n\033[1;32m==> %s\033[0m\n' "$*"; }

DOMAIN="${DAKLY_DOMAIN:-}"
ADMIN="${DAKLY_ADMIN_EMAIL:-}"
[ -n "$DOMAIN" ] || read -rp "Domain for Dakly (e.g. app.dakly.com.bd): " DOMAIN
[ -n "$ADMIN" ] || read -rp "Admin email (you sign up with this): " ADMIN
DOMAIN="${DOMAIN#https://}"; DOMAIN="${DOMAIN#http://}"; DOMAIN="${DOMAIN%%/*}"

say "Installing Docker, git and tools"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq git curl openssl dnsutils ca-certificates >/dev/null
if ! command -v docker >/dev/null || ! docker compose version >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi
systemctl enable --now docker >/dev/null 2>&1 || true

say "Opening ports 80 and 443 (if ufw is on)"
if command -v ufw >/dev/null && ufw status | grep -q active; then
  ufw allow OpenSSH >/dev/null; ufw allow 80/tcp >/dev/null; ufw allow 443/tcp >/dev/null
fi

say "Getting the code"
mkdir -p /root/.ssh && chmod 700 /root/.ssh
[ -f "$KEY" ] || ssh-keygen -t ed25519 -N "" -C "dakly-server-deploy" -f "$KEY" -q
ssh-keyscan -t ed25519 github.com >> /root/.ssh/known_hosts 2>/dev/null
export GIT_SSH_COMMAND="ssh -i $KEY -o IdentitiesOnly=yes"
until git ls-remote "$REPO" >/dev/null 2>&1; do
  echo
  echo "Add this key as a READ-ONLY deploy key on GitHub:"
  echo "  https://github.com/iamaaasif/dakly/settings/keys/new   (title: dakly-server, leave 'Allow write access' unticked)"
  echo
  cat "$KEY.pub"
  echo
  read -rp "Press Enter once it is added... " _
done
if [ -d "$DIR/.git" ]; then
  git -C "$DIR" fetch -q origin "$BRANCH" && git -C "$DIR" checkout -q "$BRANCH" && git -C "$DIR" reset -q --hard "origin/$BRANCH"
else
  git clone -q -b "$BRANCH" "$REPO" "$DIR"
fi
cd "$DIR/backend"

say "Creating .env"
NEW_ENV=0; [ -f .env ] || NEW_ENV=1
sh setup.sh >/dev/null
if [ "$NEW_ENV" = 1 ]; then
  sed -i -e "s#^APP_URL=.*#APP_URL=\"https://$DOMAIN\"#" -e "s#^ADMIN_EMAILS=.*#ADMIN_EMAILS=\"$ADMIN\"#" .env
  echo "New .env written with fresh secrets (APP_URL=https://$DOMAIN, ADMIN_EMAILS=$ADMIN)."
else
  echo "Kept the existing .env."
fi

say "Checking DNS"
MYIP=$(curl -fsS4 https://api.ipify.org || curl -fsS4 https://ifconfig.me || true)
until [ -n "$MYIP" ] && dig +short A "$DOMAIN" | grep -qx "$MYIP"; do
  echo "$DOMAIN points to: $(dig +short A "$DOMAIN" | tr '\n' ' ')  This server is: $MYIP"
  echo "Add an A record: $DOMAIN -> $MYIP (no proxy/orange cloud). Then press Enter to check again,"
  read -rp "or type 'skip' to continue anyway: " a; [ "$a" = skip ] && break
done

say "Building and starting Dakly (first build takes a few minutes)"
docker compose up -d --build

say "Waiting for https://$DOMAIN/api/health"
ok=0
for i in $(seq 1 60); do
  if curl -fsS "https://$DOMAIN/api/health" -o /tmp/dakly-health.json 2>/dev/null; then ok=1; break; fi
  sleep 5
done
docker compose ps
if [ "$ok" = 1 ]; then
  echo; cat /tmp/dakly-health.json; echo
  say "Dakly is live: https://$DOMAIN  (sign up at https://$DOMAIN/register with $ADMIN)"
else
  echo "Health check did not pass yet. Recent logs:"
  docker compose logs --tail 40 web app
fi
echo
echo "Next: fill SMTP, OpenAI, WhatsApp, SMS and payment keys in $DIR/backend/.env (see GO-LIVE.md),"
echo "then: cd $DIR/backend && docker compose up -d && docker compose exec app npm run doctor"
echo "Back up $DIR/backend/.env somewhere safe."
