#!/bin/sh
# Nightly backup of kartel-family-media: database dump + media files, one encrypted archive.
# Run on app-01 from /opt/kartel-family-media (cron, 02:40). Encryption: age, to the public key in
# backup.recipient (the private key is kept off this host). Output goes to $BACKUP_DIR and then to
# $BACKUP_TARGET, an off-site rsync destination (R0 2026-11-16: a Storage Box in a second Hetzner
# location; $BACKUP_RSH carries the ssh options, e.g. "ssh -p 23 -i /root/.ssh/kfm_backup_ed25519").
# The off-site folder mirrors the local 30-day set.
set -eu
cd "$(dirname "$0")"
STAMP=$(date -u +%Y%m%dT%H%MZ)
BACKUP_DIR=${BACKUP_DIR:-/var/backups/kartel-family-media}
mkdir -p "$BACKUP_DIR" && chmod 700 "$BACKUP_DIR"
WORK=$(mktemp -d) && trap 'rm -rf "$WORK"' EXIT
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom' > "$WORK/db.dump"
# The service runs as "node" and owns /data/media, so tar streams to stdout (no writable mount needed).
docker compose run --rm --no-deps -T --entrypoint sh media -c 'tar -C /data -cf - media' > "$WORK/media.tar"
tar -C "$WORK" -cf - db.dump media.tar | age -R backup.recipient > "$BACKUP_DIR/kfm-$STAMP.tar.age"
chmod 600 "$BACKUP_DIR/kfm-$STAMP.tar.age"
find "$BACKUP_DIR" -name 'kfm-*.tar.age' -mtime +30 -delete
if [ -n "${BACKUP_TARGET:-}" ]; then
  rsync -a --delete --include='kfm-*.tar.age' --exclude='*' -e "${BACKUP_RSH:-ssh}" "$BACKUP_DIR/" "$BACKUP_TARGET/"
fi
echo "backup ok kfm-$STAMP ($(wc -c < "$BACKUP_DIR/kfm-$STAMP.tar.age") bytes)"
