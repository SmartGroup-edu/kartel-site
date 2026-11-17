#!/bin/sh
# Restore drill (R0's Mac, never app-01): decrypt an archive into a throwaway Postgres + folder,
# print row/file counts, and prove the master key from R0's offline copy still opens the canary,
# one care note and one document file (when present). Prints counts and lengths only.
# Usage: restore-drill.sh <kfo-*.tar.age | kfo-*.dump.age> <age-identity> <master.key.age>
set -eu
ARCHIVE=$1; IDENTITY=$2; MASTER_AGE=$3
HERE=$(cd "$(dirname "$0")" && pwd)
WORK=$(mktemp -d) && chmod 700 "$WORK"
trap 'docker rm -f kfo-drill >/dev/null 2>&1 || true; rm -rf "$WORK"' EXIT
case "$ARCHIVE" in
  *.tar.age) age -d -i "$IDENTITY" "$ARCHIVE" | tar -C "$WORK" -xf - ;;
  *) age -d -i "$IDENTITY" "$ARCHIVE" > "$WORK/db.dump" ;;          # Stage 1 archives (dump only)
esac
age -d -i "$IDENTITY" "$MASTER_AGE" > "$WORK/master.key"
mkdir -p "$WORK/files"; [ -f "$WORK/docs.tar" ] && tar -C "$WORK/files" -xf "$WORK/docs.tar"
docker run -d --name kfo-drill -e POSTGRES_PASSWORD=drill -e POSTGRES_DB=drill postgres:16.9-alpine3.22 >/dev/null
until docker logs kfo-drill 2>&1 | grep -q 'PostgreSQL init process complete'; do sleep 1; done
until docker exec kfo-drill pg_isready -U postgres -d drill >/dev/null 2>&1; do sleep 1; done
docker cp "$WORK/db.dump" kfo-drill:/tmp/db.dump
# --no-privileges: the dump carries GRANTs to the request role kfo_app, which only exists where the
# service runs (it re-applies roles.sql on every start). The drill proves data + keys, not grants.
docker exec kfo-drill pg_restore -U postgres -d drill --no-owner --no-privileges /tmp/db.dump
q() { docker exec kfo-drill psql -U postgres -d drill -tAc "$1" 2>/dev/null || true; }
for t in person guardian_grant care_note access_log audit drill_canary document document_file; do
  printf '%s restored=%s\n' "$t" "$(q "SELECT count(*) FROM $t")"
done
echo "document files restored=$(find "$WORK/files" -type f | wc -l | tr -d ' ')"
q "SELECT row_to_json(n) FROM (SELECT id, wrapped_key, title_ct, body_ct FROM drill_canary LIMIT 1) n" > "$WORK/canary.json"
q "SELECT row_to_json(n) FROM (SELECT id, wrapped_key, title_ct, body_ct FROM care_note ORDER BY created_at LIMIT 1) n" > "$WORK/note.json"
q "SELECT row_to_json(n) FROM (SELECT id, wrapped_key, mime, size FROM document_file ORDER BY created_at LIMIT 1) n" > "$WORK/file.json"
node --input-type=module -e "
  import { readFileSync, existsSync } from 'node:fs';
  import { decryptNote, parseMasterKey, unwrapDataKey, openBytes } from '$HERE/crypto.mjs';
  const kek = parseMasterKey(readFileSync('$WORK/master.key'));
  const j = (f) => { const s = readFileSync(f, 'utf8').trim(); return s ? JSON.parse(s) : null; };
  const c = j('$WORK/canary.json');
  if (!c || decryptNote(kek, c).title !== 'kartel-family-os drill canary') { console.error('canary: FAILED'); process.exit(1); }
  console.log('canary decrypts: yes');
  const n = j('$WORK/note.json');
  console.log(n ? 'sample care note decrypts: yes (title ' + decryptNote(kek, n).title.length + ' chars)' : 'sample care note: none in this backup');
  const f = j('$WORK/file.json');
  if (f) {
    const p = '$WORK/files/docs/' + f.id;
    if (!existsSync(p)) { console.error('document file: MISSING from the archive'); process.exit(1); }
    const plain = openBytes(unwrapDataKey(kek, f.wrapped_key, 'file', f.id), readFileSync(p), 'file:' + f.id);
    if (plain.length !== f.size) { console.error('document file: size mismatch'); process.exit(1); }
    console.log('sample document file decrypts: yes (' + f.mime + ', ' + plain.length + ' bytes)');
  } else console.log('sample document file: none in this backup');"
echo "drill ok"
