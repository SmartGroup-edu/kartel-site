# kartel-site standalone auth — design

Replaces Keycloak OIDC on kartel.org.uk. R0 decision 2026-11-14: own sign-in, own user list, no
ecosystem identity key. Branch `kartel-site-standalone-auth`. Nothing committed, nothing deployed.

---

## 1. The lockout risk — fix this first

`/console` admits a request only if the session `sub` appears in `FAMILY_ADMIN_SUBS`
(`proxy.ts:75`). Those values are **Keycloak realm subjects**. After the realm is gone:

- no new sessions can be minted, so every existing cookie expires within 8 hours; and
- whatever replaces it issues **different** subject values, so `admins.includes(sub)` is false.

Result: `/console` and `/family` close for everyone, permanently, until that environment variable is
rewritten. **R0 locks himself out of his own console.** The re-keying below has to land before the
realm stops issuing sessions, not after.

## 2. The decision that makes this small: the email is the identity

`family-access.ts` already calls the email *"the practical INVITE key"* and already trusts it —
approval is keyed by email in Edge Config `familyAccessEmails` and in the `FAMILY_APPROVED_EMAILS`
seed. The email is already the identity everywhere except the login step itself.

So: **set the session subject to the lowercased email.** Consequences:

- **No user table.** The allowlist is the user list. Approval state stays in Edge Config exactly as
  today. Nothing new to provision, nothing new to back up.
- `proxy.ts` needs no logic change — `payload.sub` is still a string compared against an env list;
  the list now holds emails.
- `family-access.ts` collapses: `isViewerApproved(sub, email)` receives the same value twice. The
  sub-keyed `familyAccess` map is superseded by the email-keyed one.
- `FAMILY_ADMIN_SUBS` → `FAMILY_ADMIN_EMAILS`. Both are read during transition, so the variable can
  be switched without a deploy gap.

## 3. Sign-in flow

```
POST /api/family-auth/request   { email }
   → ALWAYS: set an httpOnly nonce cookie, return the same 202 / 303
   → after the response (next/server after()):
       on the allowlist?   mint a 10-minute HS256 link token bound to that nonce
                           send the link by email
GET  /api/family-auth/verify?token=…
   → verify signature, expiry, and that the nonce matches the cookie
   → mint the existing 8-hour session JWT  { sub: email, email, name }
   → clear the nonce cookie, redirect to returnTo
POST /api/family-auth/logout    → unchanged, minus the Keycloak end_session redirect
```

**No enumeration — in body, headers, or timing.** A first version set the nonce cookie only for
allowlisted addresses: the body was identical, but `Set-Cookie` revealed membership, and the mail
send made allowlisted requests measurably slower. Caught by the end-to-end test, not by unit tests.
Now every request gets a nonce cookie of the same shape, and the allowlist lookup, signing and send
all run in `after()`, once the response has gone. Verified: identical body, identical `Set-Cookie`
shape, median response time 8 ms vs 6 ms. `tests/e2e/family-auth.e2e.mjs`, 18/18.

**Same-device binding.** Verification requires the token *and* the nonce cookie set when the link
was requested. A link intercepted in transit is useless in another browser. The cost is that you
cannot request on a phone and open on a laptop — acceptable for a family console, and a deliberate
trade for not needing a revocation store.

**Replay window.** Without a datastore a token cannot be marked used, so it is replayable within its
10-minute life *in the same browser*. Stated, not hidden. If that is not acceptable, the fix is a
single Edge Config item of consumed nonces, or a KV store — both add the infrastructure this change
exists to remove.

## 3a. One-time code and named failures (bus 165, 2026-11-26)

Incident 25.11: a family member on iPhone requested twice and tapped «Sign in» in the Gmail app; the
link opened and failed with the generic message. Which rule fired was not logged (UNKNOWN): an older,
superseded link, or a link opened in a different cookie jar than the one that asked.

- **Pending sign-in in Family OS.** Every well-formed request (stranger too, with no email) is a row in
  `signin_pending`: SHA-256 of the nonce, HMAC of the address, HMAC of a six-digit code, attempts,
  `superseded_at`, `consumed_at`. No code, nonce or stranger's address leaves the site.
- **The code** is in the letter beside the button. It is typed in the tab that asked (that tab holds the
  nonce cookie), so it works whatever browser the button opens. Five attempts per request (reserved
  atomically before the comparison), 20 per client per 10 minutes, constant-time compare, audit row
  `auth:signin signin.code` without the code. `POST /api/family-auth/verify` — the same path as the
  link, so the firewall rule on `/verify` covers it.
- **Single use and supersede.** The link is used up in Family OS when it signs in; a newer request
  supersedes older links and codes for that address. This closes the replay window in §3 — while
  Family OS answers. When it does not, the link works as before and no code is sent.
- **Named failures** for a link we signed: `expired`, `elsewhere` (no cookie — a calm page that sends
  the person back to the asking tab, never shows the code, and offers a new link here), `superseded`,
  `used`. A forged or malformed token still gets the plain `invalid`. The reason code is logged.
  A link opened without its cookie is only *read* in Family OS, so mail scanners use nothing up.
- **Nonce cookie** is `__Host-kartel_family_link` in production (was unprefixed).
- **Residual:** anyone can supersede an address's pending link by requesting one for it (bounded by
  the firewall per IP and the relay's per-address cap). The code-verify per-IP limit at the edge
  depends on the existing firewall rule matching `POST /api/family-auth/verify` — UNKNOWN until the
  rule is read.

## 4. Mail delivery — no new npm dependency

Brevo transactional API, reached through **kartel-mail-relay** (`relay/`). The Brevo account blocks
API calls from unlisted IPs and Vercel has no fixed egress IP, so the site signs a request (HMAC,
60 s window) to a small relay on Hetzner, which holds the Brevo key and sends the one sign-in
template. No npm dependency on either side. `arctic` is removed; `jose` stays. Owner steps:
`relay/README.md`.

Sender: `no-reply@mail.kartel.org.uk`. A subdomain, because the apex's mail runs through IONOS with
its own DKIM/DMARC — authenticating Brevo on `mail.` leaves the apex untouched. Brevo domain
authentication needs four records in Cloudflare (TXT `mail`, CNAME `brevo1._domainkey.mail`,
CNAME `brevo2._domainkey.mail`, TXT `_dmarc.mail`); the two DKIM CNAMEs must be **DNS only**, not
proxied.

## 5. Rate limiting — owner action, not code

`/api/family-auth/request` sends mail to an address the caller supplies. Unlimited, it is an
email-bombing vector against the family allowlist. There is no KV, Redis or database here and
in-memory counters do not survive serverless invocations, so **this cannot be fixed in application
code at this architecture.**

Required: a Vercel Firewall rate-limit rule on `/api/family-auth/request` — suggested 5 requests
per IP per 10 minutes, and 3 per email per hour. Owner-run. **Treat it as a precondition of going
live, not a follow-up.**

## 6. What changes

| File | Change |
|---|---|
| `app/lib/family-env.ts` | drop `OIDC_*`; add Brevo + link TTL; `adminEmails()` reading both env names |
| `app/lib/family-auth.ts` | drop `arctic`/`KeyCloak`/JWKS/`verifyIdToken`; keep session mint/read/destroy; add link token mint/verify |
| `app/api/family-auth/login/route.ts` | → `request/route.ts` (POST email) |
| `app/api/family-auth/callback/route.ts` | → `verify/route.ts` (GET token) |
| `app/api/family-auth/logout/route.ts` | drop the Keycloak `end_session` redirect |
| `app/lib/family-access.ts` | sub and email are the same value; comments corrected |
| `app/lib/family-gate.ts` | `isFamilyAdmin` reads `adminEmails()` |
| `proxy.ts` | comments only — the OIDC references are now wrong |
| `package.json` | remove `arctic` |

Out of scope: the Family Heritage pages themselves, the console UI, and anything in `kartel-core`.

## 7. Order

1. Set `FAMILY_ADMIN_EMAILS` in production **while Keycloak still works** — both variables are read,
   so this is safe and reversible.
2. Merge this branch; the gate still runs on Keycloak until the env is switched.
3. Add the Brevo secret and the firewall rule.
4. Flip `OIDC_*` out. Sign-in moves to the link flow.
5. Only then does kartel-site stop needing the realm.

Step 1 is the one that prevents the lockout, and it is independent of everything else here.
