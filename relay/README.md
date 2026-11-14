# kartel-mail-relay — owner runbook

**Why it exists.** The Brevo account blocks API calls from unlisted IPs (only Hetzner servers are on
the list). Vercel has no fixed IP, so kartel-site cannot call Brevo directly. This relay runs on a
Hetzner node and does that call; kartel-site sends it a signed request (HMAC).

**What it is not:** a general mail relay. It sends only the sign-in email, to one recipient, and
only with a link that starts with `https://kartel.org.uk/api/family-auth/verify?token=`. Rate
limits: 3 per address per hour, 60 per hour in total. No address is ever written to the log.

Tests: `node --test relay/relay.test.mjs` — 8/8 (Brevo mocked, nothing sent).

---

## Steps — about 20 minutes, in this order

### 1. Two secrets (on your Mac)

```bash
openssl rand -hex 32     # → RELAY_SECRET (goes in two places: relay.env and Vercel)
```
Brevo → **SMTP & API → API keys → Generate API key**, name `kartel-mail-relay` → copy it once.

### 2. Cloudflare tunnel (no port opened on the server)

Cloudflare → **Zero Trust → Networks → Tunnels → Create a tunnel** → Cloudflared →
name `kartel-mail-relay` → copy the **token** from the install command (the long string after
`--token`). Then **Public hostname**:

| Subdomain | Domain | Service |
|---|---|---|
| `mail-relay` | `kartel.org.uk` | `HTTP` · `relay:8787` |

### 3. Server (app-01, KARTEL cluster)

```bash
# from the kartel-site folder on your Mac
eval "$(ssh-agent -s)" && ssh-add ~/.ssh/hetzner_ed25519
scp -J operator@10.8.0.1 relay/server.mjs relay/Dockerfile relay/compose.yaml relay/relay.env.example root@10.0.0.3:/opt/kartel-mail-relay/
ssh -J operator@10.8.0.1 root@10.0.0.3
```
If `scp` says the folder does not exist: `ssh … 'mkdir -p /opt/kartel-mail-relay'` first.

On the server:
```bash
cd /opt/kartel-mail-relay
cp relay.env.example relay.env && nano relay.env      # fill RELAY_SECRET and BREVO_API_KEY
echo 'TUNNEL_TOKEN=paste-token-here' > .env
chmod 600 relay.env .env
curl -s https://api.ipify.org; echo                    # ← this server's outgoing IP, note it
docker compose up -d --build
docker compose ps                                      # both "running", relay "healthy"
```

### 4. Brevo — allow that IP

Brevo → **Security → Authorized IPs → Authorize IP addresses** → paste the IP from step 3.
(Leave the other entry in "Unauthorized IP addresses" alone — it is not ours.)

### 5. Check

```bash
curl -s https://mail-relay.kartel.org.uk/healthz       # → {"ok":true}
```

### 6. Vercel → kartel-site → Settings → Environment Variables (Production)

| Key | Value | Type |
|---|---|---|
| `FAMILY_MAIL_RELAY_URL` | `https://mail-relay.kartel.org.uk` | plain |
| `FAMILY_MAIL_RELAY_SECRET` | the same `RELAY_SECRET` | **Sensitive** |

`BREVO_API_KEY` is **not** needed in Vercel any more.

### 7. Deploy, then clean up

Push branch `kartel-site-standalone-auth` and merge → Vercel deploys. Sign in at
`https://kartel.org.uk/en/family/signin` with your address; the letter comes from
`no-reply@mail.kartel.org.uk`. Then delete `OIDC_*` and `FAMILY_ADMIN_SUBS` in Vercel.

## If something fails

| Symptom | Where to look |
|---|---|
| No letter | `docker compose logs relay` on app-01 |
| `brevo 401` in that log | the IP from step 3 is not authorized in Brevo, or the key is wrong |
| `rejected: bad signature` | secret differs between relay.env and Vercel, or server clock is off |
| `healthz` does not answer | `docker compose logs cloudflared`; tunnel hostname in step 2 |
| Vercel log `mail relay failed: …` | the status code tells which of the above |

Rollback: `docker compose down` on app-01. The site keeps answering identically (no address is
revealed); only the letters stop.
