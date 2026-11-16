#!/bin/sh
# Restore drill (run on R0's Mac, never on app-01): decrypt an archive into a throwaway Postgres,
# print row counts, and prove ONE care note decrypts with the master key from R0's offline copy.
# Prints counts and lengths only — never note text.
# Usage: restore-drill.sh <kfo-*.dump.age> <age-identity> <master.key.age>
set -eu
ARCHIVE=$1; IDENTITY=$2; MASTER_AGE=$3
HERE=$(cd "$(dirname "$0")" && pwd)
WORK=$(mktemp -d) && chmod 700 "$WORK"
trap 'docker rm -f kfo-drill >/dev/null 2>&1 || true; rm -rf "$WORK"' EXIT
age -d -i "$IDENTITY" "$ARCHIVE" > "$WORK/db.dump"
age -d -i "$IDENTITY" "$MASTER_AGE" > "$WORK/master.key"
docker run -d --name kfo-drill -e POSTGRES_PASSWORD=drill -e POSTGRES_DB=drill postgres:16.9-alpine3.22 >/dev/null
until docker logs kfo-drill 2>&1 | grep -q 'PostgreSQL init process complete'; do sleep 1; done
until docker exec kfo-drill pg_isready -U postgres -d drill >/dev/null 2>&1; do sleep 1; done
docker cp "$WORK/db.dump" kfo-drill:/tmp/db.dump
docker exec kfo-drill pg_restore -U postgres -d drill --no-owner /tmp/db.dump
for t in person guardian_grant care_note access_log audit drill_canary; do
  printf '%s restored=%s\n' "$t" "$(docker exec kfo-drill psql -U postgres -d drill -tAc "SELECT count(*) FROM $t")"
done
docker exec kfo-drill psql -U postgres -d drill -tAc "SELECT row_to_json(n) FROM (SELECT id, wrapped_key, title_ct, body_ct FROM drill_canary LIMIT 1) n" > "$WORK/canary.json"
node --input-type=module -e "
  import { readFileSync } from 'node:fs';
  import { decryptNote, parseMasterKey } from '$HERE/crypto.mjs';
  const n = decryptNote(parseMasterKey(readFileSync('$WORK/master.key')), JSON.parse(readFileSync('$WORK/canary.json', 'utf8')));
  if (n.title !== 'kartel-family-os drill canary') { console.error('canary: WRONG plaintext'); process.exit(1); }
  console.log('canary decrypts: yes');"
docker exec kfo-drill psql -U postgres -d drill -tAc "SELECT row_to_json(n) FROM (SELECT id, wrapped_key, title_ct, body_ct FROM care_note ORDER BY created_at LIMIT 1) n" > "$WORK/sample.json"
if [ -s "$WORK/sample.json" ]; then
  node --input-type=module -e "
    import { readFileSync } from 'node:fs';
    import { decryptNote, parseMasterKey } from '$HERE/crypto.mjs';
    const row = JSON.parse(readFileSync('$WORK/sample.json', 'utf8'));
    const n = decryptNote(parseMasterKey(readFileSync('$WORK/master.key')), row);
    console.log('sample care note decrypts: yes (title ' + n.title.length + ' chars, body ' + n.body.length + ' chars)');"
else
  echo "sample care note: none in this backup"
fi
echo "drill ok"
