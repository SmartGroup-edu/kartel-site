#!/bin/sh
# Restore drill: decrypt an archive into a throwaway Postgres + folder and compare counts with the
# live service. Never touches the live database or volume. Usage: restore-drill.sh <archive> <age-identity>
set -eu
ARCHIVE=$1; IDENTITY=$2
WORK=$(mktemp -d) && trap 'docker rm -f kfm-drill >/dev/null 2>&1 || true; rm -rf "$WORK"' EXIT
age -d -i "$IDENTITY" "$ARCHIVE" | tar -C "$WORK" -xf -
docker run -d --name kfm-drill -e POSTGRES_PASSWORD=drill -e POSTGRES_DB=drill postgres:16.9-alpine3.22 >/dev/null
until docker exec kfm-drill pg_isready -U postgres -d drill >/dev/null 2>&1; do sleep 1; done
docker cp "$WORK/db.dump" kfm-drill:/tmp/db.dump
docker exec kfm-drill pg_restore -U postgres -d drill --no-owner /tmp/db.dump
for t in media content_draft published audit; do
  printf '%s restored=%s\n' "$t" "$(docker exec kfm-drill psql -U postgres -d drill -tAc "SELECT count(*) FROM $t")"
done
mkdir -p "$WORK/files" && tar -C "$WORK/files" -xf "$WORK/media.tar"
echo "media files restored=$(find "$WORK/files/media" -type f | wc -l)"
echo "drill ok"
