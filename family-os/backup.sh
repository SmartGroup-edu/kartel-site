#!/bin/sh
# Nightly backup of kartel-family-os: database dump + the document volume (files are already
# AES-256-GCM ciphertext), one archive encrypted with age to R0's recipient (backup.recipient).
# The master key is NOT in the backup — restoring notes/documents also needs R0's offline copy.
# Off-site: $BACKUP_TARGET via $BACKUP_RSH (the Hetzner Storage Box, folder kfo).
set -eu
cd "$(dirname "$0")"
STAMP=$(date -u +%Y%m%dT%H%MZ)
BACKUP_DIR=${BACKUP_DIR:-/var/backups/kartel-family-os}
mkdir -p "$BACKUP_DIR" && chmod 700 "$BACKUP_DIR"
WORK=$(mktemp -d) && trap 'rm -rf "$WORK"' EXIT
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom' > "$WORK/db.dump"
docker compose run --rm --no-deps -T --entrypoint sh os -c 'tar -C /data -cf - docs' > "$WORK/docs.tar"
tar -C "$WORK" -cf - db.dump docs.tar | age -R backup.recipient > "$BACKUP_DIR/kfo-$STAMP.tar.age"
chmod 600 "$BACKUP_DIR/kfo-$STAMP.tar.age"
find "$BACKUP_DIR" -name 'kfo-*.age' -mtime +30 -delete
if [ -n "${BACKUP_TARGET:-}" ]; then
  rsync -a --delete --include='kfo-*.age' --exclude='*' -e "${BACKUP_RSH:-ssh}" "$BACKUP_DIR/" "$BACKUP_TARGET/"
fi
echo "backup ok kfo-$STAMP ($(wc -c < "$BACKUP_DIR/kfo-$STAMP.tar.age") bytes)"
