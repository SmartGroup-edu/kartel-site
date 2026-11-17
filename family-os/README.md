# kartel-family-os — runbook (Stage 1)

**What it is.** The Family OS service behind `/family/os` (plan: `KARTEL/docs/family-crm-plan.md` v3).
Stage 1 holds:
- people and their role (adult or child);
- guardian grants with scopes (routines / health / education);
- encrypted care notes;
- an append-only read log.

The site (Vercel) is the only client. Every request is HMAC-signed, with the same scheme as
family-media (`app/lib/media-signature.mjs`). The signed actor is `admin:<email>` or `member:<email>`.

**Why a separate service, not an extension of family-media.**
- **Separate data (CGOS D03).** Project data is not merged into one database. Heritage photos and the
  family's live records have different owners, readers and retention.
- **Separate keys.** This service holds an encryption master key; family-media has none. A bug or
  compromise in one does not reach the other.
- **Same proven pattern.** The HMAC scheme, tunnel + Access, backup pipeline and runbook all carry over,
  so there is nothing new to learn operationally.

## Access rules (policy.mjs, tested)
| Who | Can |
|---|---|
| Admin (`FAMILY_ADMIN_EMAILS`) | Add people, give and revoke grants, see emails. **Not** an implicit reader of notes |
| Adult | Read and write their own care notes |
| Guardian (active grant on a child) | Read and write that child's notes **only** for kinds in the grant's scopes. Both parents get a `parent` grant; anyone else only by an explicit admin grant |
| Child | Today and the people list. No access to health or education notes (plan v3 §3) |
| Revocation | Applies on the next request (grants are read on every request) |

## Encryption (crypto.mjs)
- **Envelope encryption.** Each note has its own random 256-bit data key, used for AES-256-GCM on each
  field. The data key is wrapped with the master key (AES-256-GCM).
- **AAD binding.** Each ciphertext is bound to its note id and field name, so copying a ciphertext to
  another row or field fails.
- **Master key.** 32 bytes in `secrets/master.key`, mounted read-only into the container. Never in the
  image, the database, a backup or a log.
  - **Auto-unlock (R0 2026-11-16).** The service starts on its own after a restart.
  - **Host file permissions:** owner uid 1000 (the container's `node` user), mode 400.
    `install -o 1000 -g 1000 -m 400 /dev/stdin secrets/master.key`
- **R0's offline copy.** Generated on the host, age-encrypted to R0's recipient
  (`backup.recipient`), and streamed to `~/infra/keys/kartel-family-os-master.key.age` on R0's Mac.
  It is never displayed. **R0's step:** store that one file in 1Password (through the app) and on the
  offline drive, next to the backup identity.
- **Rotation.** `rewrap()` re-wraps the data keys under a new master key; the field ciphertexts stay.

## Documents (Stage 2a)
Each person has a «Документы» section: passports, national IDs and personal codes, NI numbers,
residence and settlement documents, and other documents.

**Stored data:**
- **Files:** PDF / JPEG / PNG / HEIC up to 10 MB at the service, and 4 MB through the site (the Vercel
  body limit).
  - The type is checked by magic bytes; anything else gets 415.
  - JPEG and PNG are re-encoded, so no EXIF/GPS survives.
  - Every file has its own data key and is stored on the `docs` volume as AES-GCM ciphertext under a
    random id. The original name is encrypted too.
  - Files are served only through `GET /documents/:id/files/:fid` after an access check and a
    read-log row. The site serves them `private, no-store` with `CSP: sandbox`.
- **Fields:** the number and personal code are encrypted. Lists carry only the last 3 characters.
  - «Показать» (`/reveal`) and «Копировать» (`/copied`) each write a log row before anything is
    returned. The holder name, birth data, authority and nationality are an encrypted JSON blob.
  - Type, issuing country and dates stay plain: lists and expiry reminders need them.
  - Residence and settlement documents keep the type and file only.

**Access:**
- The holder (a minor too) and guardians whose grant includes `documents`.
- An adult's documents are hers alone.
- The admin may **add** documents but reads them only under those same rules.
- Heritage archive records (`/archive/documents`) are admin-only.

**Today** lists documents expiring within ~6 months (or already expired) for the people you may read.

**Backups and drill:**
- The backup archive holds the DB dump and the `docs` volume (ciphertext).
- The drill decrypts the canary, one care note and one document file using R0's offline master key.

## Read log (fail-closed)
- Every read and write of care notes is written to `access_log` **before** any data is returned. If that
  write fails, the request fails with 503 (tested).
- `access_log` is append-only: triggers block UPDATE, DELETE and TRUNCATE (verified on Postgres).

## Deploy (app-01; standing R0 permission for KARTEL infra, 2026-11-16) — NOT before kartel-qa passes
1. `/opt/kartel-family-os`: copy the files from `main` and compare sha256.
2. Generate the secrets on the host and never print them:
   - `db.env`, `os.env` (with `FAMILY_OS_SECRET = openssl rand -hex 32`), mode 600;
   - `secrets/master.key` (`openssl rand 32`, uid 1000, mode 400);
   - `backup.recipient` (copied from family-media).
3. Stream the age copy of the master key to R0's Mac (see above).
4. Set up a Cloudflare tunnel `kartel-family-os` and an Access app with a service token. Move the
   tokens with the one-time RSA-OAEP pipe (`family-media/README.md`).
5. Vercel (Production): set `FAMILY_OS_URL`, `FAMILY_OS_SECRET`, `FAMILY_OS_ACCESS_CLIENT_ID` and
   `FAMILY_OS_ACCESS_CLIENT_SECRET`, then redeploy.
6. Backups: cron at 02:50 runs `backup.sh` with the same Storage Box (`BACKUP_TARGET=…:kfo`).
7. Restore drill from the off-site copy on the Mac:
   `restore-drill.sh <archive> <age identity> <master.key.age>`. It must print
   `sample care note decrypts: yes`.

## Logs
- One line per request: method, route class, status, duration.
- Never emails, names, note text or ids.
