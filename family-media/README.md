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
| Site env | `FAMILY_MEDIA_URL`, `FAMILY_MEDIA_SECRET` (sensitive). **Unset = feature off**: the family page renders exactly as before. Optional `FAMILY_MEDIA_ACCESS_CLIENT_ID` + `FAMILY_MEDIA_ACCESS_CLIENT_SECRET` (sensitive): a Cloudflare Access service token, sent as `CF-Access-Client-*` headers when both are set |
| Access from the Mac | WireGuard to bastion-01 does not route `10.0.0.0/24`; jump through bastion-01's public address: `ssh -J operator@<bastion-01> operator@10.0.0.3` (with `IdentitiesOnly` and the hetzner key on both hops) |

## Deploy (Class 4 — needs R0's explicit "да" for this act)

Same path as the mail relay (app-01 `10.0.0.3`, `/opt/kartel-family-media`, files streamed over ssh
with `sudo tee` because SFTP is off; compare sha256 on both ends).

1. Secrets, generated on app-01, never on screen: `db.env` (`POSTGRES_USER`, `POSTGRES_PASSWORD`,
   `POSTGRES_DB`), `media.env` (`DATABASE_URL`, `FAMILY_MEDIA_SECRET` = `openssl rand -hex 32`),
   `.env` (`TUNNEL_TOKEN` for a new tunnel `kartel-family-media`). All mode 600.
2. `sudo docker compose up -d --build`, then `curl https://<media host>/healthz` → `{"ok":true}`.
3. Vercel (Production): `FAMILY_MEDIA_URL`, `FAMILY_MEDIA_SECRET` (piped from app-01, sensitive), redeploy.
4. Infra baseline v3: `ss -tlnp` shows no new listening port on the host (G3, G6); external port
   scan (G12); pinned images (G11 — postgres 16.9-alpine3.22, cloudflared 2025.9.1, node 24.15.0 — same major as Vercel, CI and `.nvmrc`).

## Backups — required before go-live

`backup.sh` (cron 02:40): `pg_dump` + media tar → one archive, encrypted with `age` to a public key
(`backup.recipient`; the private key lives off this host), kept 30 days in
`/var/backups/kartel-family-media`, optionally copied to `$BACKUP_TARGET`.

`restore-drill.sh <archive> <identity>` restores into a throwaway Postgres + folder and prints row
and file counts. **Go-live needs one successful drill on record.**

**Off-site (R0 decision 2026-11-16):** a Hetzner Storage Box in a second location (hel1; app-01 is
in fsn1), reachable only from inside Hetzner, written over ssh port 23 with a key that exists only
on app-01 (`/root/.ssh/kfm_backup_ed25519`). Cron sets `BACKUP_TARGET=<user>@<box>:kfm` and
`BACKUP_RSH="ssh -p 23 -i /root/.ssh/kfm_backup_ed25519"`; the box mirrors the local 30-day set, and
the box's own daily snapshots keep earlier copies even if app-01 deletes files. This deviates from the
DR doctrine (`30-Decisions/2026-05-31-disaster-recovery-doctrine-v1-RECORDED`: B2 Object Lock + an
air-gapped drive) — R0's decision for this data: own Hetzner only.

**Age identity:** the private key lives with R0 (created on R0's Mac, `~/infra/keys/`, mode 600);
app-01 has only `backup.recipient`. Keep a copy in 1Password (through the app) and one offline.

**Drill from the off-site copy:** stream the newest archive from the box through app-01 to the Mac
(`ssh app-01 'sudo ssh -p 23 -i … <box> cat kfm/<archive>'`), then run `restore-drill.sh` on the
Mac with the identity. Compare the counts with the live tables.

## Live state (go-live 2026-11-16)

- **Running on app-01:**
  - db, media and cloudflared;
  - the tunnel `kartel-family-media` is healthy;
  - Cloudflare Access app `kartel-family-media` sits in front of the hostname with a single service-auth policy (service token `kartel-site-family-media`, 1 year).
- **Without the token:**
  - the edge answers 403;
  - with the token but no HMAC signature, the service answers 401.
- **Vercel Production:**
  - `FAMILY_MEDIA_URL`;
  - `FAMILY_MEDIA_SECRET`;
  - `FAMILY_MEDIA_ACCESS_CLIENT_ID` and `FAMILY_MEDIA_ACCESS_CLIENT_SECRET` (all sensitive except the URL).
- **Moving a secret that only an API response carries (tunnel token, Access token)** without it ever being displayed:
  1. Make a one-time RSA-4096 key on the destination host.
  2. In the API call, encrypt the value to its public key with RSA-OAEP-SHA256.
  3. Decrypt on the host and pipe it to where it lives.
  4. Shred the key.
- **Testing Access:** test from an ordinary client. A `fetch` from inside a Cloudflare API sandbox got 403 even with a valid token.
- **New Storage Box hostnames** take a few minutes to appear in DNS: the first push failed with "Could not resolve hostname" and succeeded once it resolved.
- **Token renewal:** the Access service token expires after one year; renew it before 2027-11-16.

## Rollback

`sudo docker compose down` on app-01, and unset `FAMILY_MEDIA_URL` in Vercel (then redeploy). The family page falls
back to the static content immediately (reads fail soft). Data stays in the volumes.

## Logs

Status codes and ids only — never names, text, emails or file contents.
