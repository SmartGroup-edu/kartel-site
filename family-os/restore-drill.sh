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
echo "pg_restore exit=0"
q() { docker exec kfo-drill psql -U postgres -d drill -tAc "$1" 2>/dev/null || true; }
qd() { docker exec kfo-drill psql -U postgres -d "$1" -tAc "$2" 2>/dev/null || true; }
for t in person guardian_grant care_note access_log audit drill_canary document document_file; do
  printf '%s restored=%s\n' "$t" "$(q "SELECT count(*) FROM $t")"
done
echo "document files restored=$(find "$WORK/files" -type f | wc -l | tr -d ' ')"

# --- Schema checks (bus 155/157b): the service's own migrations on the restored data, then the result compared
# with a fresh build. Counts only. Fails (exit 1) on any difference.
counts_sql() { echo "SELECT string_agg(t || '=' || c, ',' ORDER BY t) FROM (SELECT table_name AS t, (xpath('/row/c/text()', query_to_xml(format('SELECT count(*) AS c FROM %I', table_name), false, true, '')))[1]::text AS c FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE') x"; }
before=$(q "$(counts_sql)")
echo "tables restored=$(q "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'")"
docker cp "$HERE/schema.sql" kfo-drill:/tmp/schema.sql
docker cp "$HERE/roles.sql" kfo-drill:/tmp/roles.sql
docker exec kfo-drill psql -U postgres -d drill -v ON_ERROR_STOP=1 -q -f /tmp/schema.sql >/dev/null || { echo "schema.sql on restored db: FAILED"; exit 1; }
echo "schema.sql on restored db: exit 0"
docker exec kfo-drill psql -U postgres -d drill -v ON_ERROR_STOP=1 -q -c "DO \$\$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'kfo_app') THEN CREATE ROLE kfo_app LOGIN PASSWORD 'drill-only-kfo-app-password'; END IF; END \$\$" -f /tmp/roles.sql >/dev/null || { echo "roles.sql on restored db: FAILED"; exit 1; }
echo "roles.sql on restored db: exit 0"
deny=$(docker exec -e PGPASSWORD=drill-only-kfo-app-password kfo-drill psql -h 127.0.0.1 -U kfo_app -d drill -tAc "UPDATE access_log SET actor = actor WHERE false" 2>&1 || true)
case "$deny" in *"permission denied"*) echo "kfo_app UPDATE access_log: denied";; *) echo "kfo_app UPDATE access_log: NOT denied"; exit 1;; esac
[ "$before" = "$(q "$(counts_sql)")" ] && echo "row counts unchanged by migrations: yes" || { echo "row counts unchanged by migrations: NO"; exit 1; }
docker exec kfo-drill psql -U postgres -d postgres -q -c "CREATE DATABASE fresh" >/dev/null
docker exec kfo-drill psql -U postgres -d fresh -v ON_ERROR_STOP=1 -q -f /tmp/schema.sql >/dev/null
# contype is "char": cast it to text before joining it into a string (bus 155b).
for kind in \
  "COLS|SELECT table_name || '.' || column_name || ':' || data_type || ':' || is_nullable FROM information_schema.columns WHERE table_schema = 'public'" \
  "CONS|SELECT conrelid::regclass::text || ':' || conname || ':' || contype::text || ':' || pg_get_constraintdef(oid) FROM pg_constraint WHERE connamespace = 'public'::regnamespace" \
  "IDX|SELECT indexdef FROM pg_indexes WHERE schemaname = 'public'" \
  "TRG|SELECT event_object_table || ':' || trigger_name || ':' || event_manipulation FROM information_schema.triggers WHERE trigger_schema = 'public'"; do
  name=${kind%%|*}; sql=${kind#*|}
  a=$(qd drill "$sql" | sort); b=$(qd fresh "$sql" | sort)
  if [ "$a" = "$b" ]; then echo "schema $name: equal ($(printf '%s\n' "$a" | grep -c .) entries)"; else echo "schema $name: DIFFERENT"; exit 1; fi
done
echo "constraints not validated=$(q "SELECT count(*) FROM pg_constraint WHERE connamespace = 'public'::regnamespace AND NOT convalidated")"
# Every foreign key dropped and re-added (so validated against every restored row), inside one rolled-back
# transaction. Each statement ends with ';' (bus 155b: the drill's fk.sql did not, and psql refused it).
q "SELECT 'ALTER TABLE ' || conrelid::regclass::text || ' DROP CONSTRAINT ' || quote_ident(conname) || '; ALTER TABLE ' || conrelid::regclass::text || ' ADD CONSTRAINT ' || quote_ident(conname) || ' ' || pg_get_constraintdef(oid) || ';' FROM pg_constraint WHERE connamespace = 'public'::regnamespace AND contype::text = 'f'" > "$WORK/fk.sql"
fks=$(grep -c . "$WORK/fk.sql" || true)
{ echo "BEGIN;"; cat "$WORK/fk.sql"; echo "ROLLBACK;"; } > "$WORK/fk-tx.sql"
docker cp "$WORK/fk-tx.sql" kfo-drill:/tmp/fk.sql
if docker exec kfo-drill psql -U postgres -d drill -v ON_ERROR_STOP=1 -q -f /tmp/fk.sql >/dev/null; then echo "foreign keys re-added against all rows: $fks/$fks"; else echo "foreign keys re-added: FAILED"; exit 1; fi
missing=0
for id in $(q "SELECT id FROM document_file"); do [ -f "$WORK/files/docs/$id" ] || missing=$((missing + 1)); done
echo "document_file rows=$(q "SELECT count(*) FROM document_file"), rows without a file=$missing"
[ "$missing" = 0 ] || exit 1
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
