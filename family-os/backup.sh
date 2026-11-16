#!/bin/sh
# Nightly backup of kartel-family-os: database dump only, encrypted with age to R0's recipient
# (backup.recipient). Care-note fields inside are already ciphertext; the master key is NOT in the
# backup — restoring the notes also needs R0's offline copy of the master key (README).
# Off-site: $BACKUP_TARGET via $BACKUP_RSH (the same Hetzner Storage Box as family-media, folder kfo).
set -eu
cd "$(dirname "$0")"
STAMP=$(date -u +%Y%m%dT%H%MZ)
BACKUP_DIR=${BACKUP_DIR:-/var/backups/kartel-family-os}
mkdir -p "$BACKUP_DIR" && chmod 700 "$BACKUP_DIR"
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom' | age -R backup.recipient > "$BACKUP_DIR/kfo-$STAMP.dump.age"
chmod 600 "$BACKUP_DIR/kfo-$STAMP.dump.age"
find "$BACKUP_DIR" -name 'kfo-*.dump.age' -mtime +30 -delete
if [ -n "${BACKUP_TARGET:-}" ]; then
  rsync -a --delete --include='kfo-*.dump.age' --exclude='*' -e "${BACKUP_RSH:-ssh}" "$BACKUP_DIR/" "$BACKUP_TARGET/"
fi
echo "backup ok kfo-$STAMP ($(wc -c < "$BACKUP_DIR/kfo-$STAMP.dump.age") bytes)"
