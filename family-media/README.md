# kartel-family-media — runbook

**What it is.** Private storage for the gated family area of kartel.org.uk: portraits, photos and
the dates, places, professions and short stories an admin adds in `/family/admin`. Nothing here is
public. The site (Vercel) is the only client; every request is signed (HMAC-SHA256 over
`ts.nonce.METHOD.path.actor.sha256(body)`, 60 s window, each signature usable once —
`app/lib/media-signature.mjs`). Viewers only ever receive files that the **published** content uses,
through `/api/family-media/…` on the site, which checks the session first and answers
`Cache-Control: private, no-store`.

**What it is not.** Not a CMS for names or the existing chronicle text (those stay in
`app/content/family-private.ts`), not a public image host, not a place for anyone but admins to write.

## Pieces

| Piece | Where |
|---|---|
| Service | `server.mjs` (HTTP), `store.mjs` (Postgres), `validate.mjs` (field rules, plain text only), `images.mjs` (decode → re-encode) |
| Schema | `schema.sql`, applied on every start (idempotent) |
| Images | JPEG/PNG/WebP in, ≤ 4 MB (the editor downsizes in the browser first). Fully decoded, EXIF orientation applied, re-encoded to 256/640/1280 px WebP + AVIF. **The original is never stored and no metadata (EXIF/GPS/XMP) survives.** |
| Data | Postgres 16 in the same compose, on an `internal` network (no route out, no host port) |
| Files | Docker volume `media`, owner `node`, mode 700 |
| Reach | Cloudflare tunnel → `media:8788`. No host port published; firewall stays default-deny |
| Site env | `FAMILY_MEDIA_URL`, `FAMILY_MEDIA_SECRET` (sensitive). **Unset = feature off**: the family page renders exactly as before |

## Deploy (Class 4 — needs R0's explicit "да" for this act)

Same path as the mail relay (app-01 `10.0.0.3`, `/opt/kartel-family-media`, files streamed over ssh
with `sudo tee` because SFTP is off; compare sha256 on both ends).

1. Secrets, generated on app-01, never on screen: `db.env` (`POSTGRES_USER`, `POSTGRES_PASSWORD`,
   `POSTGRES_DB`), `media.env` (`DATABASE_URL`, `FAMILY_MEDIA_SECRET` = `openssl rand -hex 32`),
   `.env` (`TUNNEL_TOKEN` for a new tunnel `kartel-family-media`). All mode 600.
2. `sudo docker compose up -d --build`, then `curl https://<media host>/healthz` → `{"ok":true}`.
3. Vercel (Production): `FAMILY_MEDIA_URL`, `FAMILY_MEDIA_SECRET` (piped from app-01, sensitive), redeploy.
4. Infra baseline v3: `ss -tlnp` shows no new listening port on the host (G3, G6); external port
   scan (G12); pinned images (G11 — postgres 16.9-alpine3.22, cloudflared 2025.9.1, node 22.18.0).

## Backups — required before go-live

`backup.sh` (cron 02:40): `pg_dump` + media tar → one archive, encrypted with `age` to a public key
(`backup.recipient`; the private key lives off this host), kept 30 days in
`/var/backups/kartel-family-media`, optionally copied to `$BACKUP_TARGET`.

`restore-drill.sh <archive> <identity>` restores into a throwaway Postgres + folder and prints row
and file counts. **Go-live needs one successful drill on record.**

Open decision (R0): the DR doctrine (`30-Decisions/2026-05-31-disaster-recovery-doctrine-v1-RECORDED`)
requires an immutable off-site copy (B2 Object Lock + an air-gapped drive); R0's instruction for this
data is "own Hetzner servers, no third-party storage". Until R0 picks, the off-site target is unset.

## Rollback

`sudo docker compose down` on app-01, and unset `FAMILY_MEDIA_URL` in Vercel. The family page falls
back to the static content immediately (reads fail soft). Data stays in the volumes.

## Logs

Status codes and ids only — never names, text, emails or file contents.
