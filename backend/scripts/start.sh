#!/bin/sh
# Container entrypoint: check .env, wait for the database, apply migrations, start Dakly.
set -e
cd /app
node_modules/.bin/tsx scripts/doctor.ts --startup
node_modules/.bin/prisma migrate deploy
exec node_modules/.bin/next start -H 0.0.0.0 -p "${PORT:-3000}"
