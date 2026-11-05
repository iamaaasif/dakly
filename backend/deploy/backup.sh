#!/bin/sh
# Dumps the Dakly database to ./backups every EVERY_HOURS hours and keeps KEEP_DAYS days.
# Restore: see OPERATIONS.md ("Backups and restore").
mkdir -p /backups
while true; do
  name="dakly-$(date -u +%Y%m%d-%H%M).sql.gz"
  if pg_dump --no-owner --no-privileges | gzip > "/backups/partial.gz"; then
    mv "/backups/partial.gz" "/backups/$name"
    echo "[backup] wrote $name ($(du -h "/backups/$name" | cut -f1))"
  else
    echo "[backup] FAILED at $(date -u)"
  fi
  find /backups -name 'dakly-*.sql.gz' -mtime +"${KEEP_DAYS:-14}" -delete
  sleep $(( ${EVERY_HOURS:-24} * 3600 ))
done
