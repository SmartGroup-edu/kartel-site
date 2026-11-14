# kartel-mail-relay — runbook

**Why it exists.** The Brevo account blocks API calls from unlisted IPs. Vercel has no fixed IP,
so kartel-site cannot call Brevo directly. This relay runs on Hetzner and makes that call; the site
sends it a signed request (HMAC-SHA256, 60 s window — `app/lib/relay-signature.mjs`).

**What it is not:** a general mail relay. One template, one recipient, and only a link starting
with `https://kartel.org.uk/api/family-auth/verify?token=`. Limits: 3 per address per hour, 60 per
hour in total — a request is counted only if both have room. No address is ever logged.

Tests: `npm test` (includes `relay/*.test.mjs`; Brevo is mocked, nothing is sent).

## Where it runs (as deployed 2026-11-14)

| What | Value |
|---|---|
| Node | app-01, `10.0.0.3` (KARTEL cluster), reached over the WireGuard VPN |
| Login | `ssh -i ~/.ssh/hetzner_ed25519 operator@10.0.0.3` — `operator` has sudo; use `sudo docker …` |
| Folder | `/opt/kartel-mail-relay` (`server.mjs`, `Dockerfile`, `compose.yaml`, `relay.env`, `.env`) |
| Public URL | `https://mail-relay.kartel.org.uk` via Cloudflare tunnel `kartel-mail-relay` → `http://relay:8787` |
| Egress | **IPv4 `178.105.16.72`** — on the Brevo Authorized IPs list. IPv6 is disabled on the compose network on purpose: the host's IPv6 is NOT on the list. |
| Secrets | `relay.env`: `RELAY_SECRET`, `BREVO_API_KEY` · `.env`: `TUNNEL_TOKEN` — all mode 600, server only |

Matching Vercel variables (kartel-site, Production): `FAMILY_MAIL_RELAY_URL` (plain),
`FAMILY_MAIL_RELAY_SECRET` (sensitive, = `RELAY_SECRET`).

## Secret handling — values never pass through a screen, chat or a file on the Mac

| Secret | Source | How it reaches the server |
|---|---|---|
| `BREVO_API_KEY` | 1Password item `kartel-mail-relay BREVO API key` | `op read … \| ssh … ` straight into `relay.env` |
| `RELAY_SECRET` | generated on app-01 (`openssl rand -hex 32`) | piped from app-01 into `vercel env add … --sensitive` |
| `TUNNEL_TOKEN` | Cloudflare API (tunnel token endpoint) | piped into `.env` on app-01 |

Store keys in 1Password **through the app**, not `op item create` via stdin — that path saved an
empty value once (2026-11-14).

## Update / redeploy

```bash
# from the kartel-site folder on the Mac
# app-01 has SFTP disabled, so scp fails (found 2026-11-14). Stream each file over ssh instead
# (sudo tee into /opt/kartel-mail-relay/<file>), then compare sha256 on both ends before rebuilding.
ssh -i ~/.ssh/hetzner_ed25519 operator@10.0.0.3 'cd /opt/kartel-mail-relay && sudo docker compose up -d --build && sudo docker compose ps'
curl -s https://mail-relay.kartel.org.uk/healthz          # → {"ok":true}
```

## If something fails

| Symptom | Where to look |
|---|---|
| No letter | `sudo docker compose logs relay` on app-01 |
| `brevo 401` | egress IP not on the Brevo list (check IPv4 is used), or key revoked |
| `rejected: bad signature` | secret differs between `relay.env` and Vercel, or clock skew > 60 s |
| `healthz` does not answer | `sudo docker compose logs cloudflared`; tunnel route in Cloudflare |
| Vercel log `mail relay failed: …` | the status code says which of the above |
| Brevo mail "Verify a new IP" | a call left by an unlisted address — do not authorize blindly; find out which |

Rollback: `sudo docker compose down` on app-01. The site keeps answering identically; only the
letters stop.
