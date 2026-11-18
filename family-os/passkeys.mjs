// Passkeys (WebAuthn) for Family OS — design bus 98, security review bus 100 (approved with C1–C4).
// A second way into the same identity: the email. Public keys only; discoverable credentials, so sign-in takes no
// email (no enumeration); single-use challenges here in Postgres; user verification required by the server.
//
// Library: @simplewebauthn/server 14.0.3 (pinned exactly). NOTE on its counter check: in 14.0.3
// verifyAuthenticationResponse compares the counter BEFORE it verifies the signature. Acting on that error would
// let an unsigned, forged response flag someone else's key. So we verify with counter 0 (its check is then
// skipped) and compare the counter ourselves only after the signature has verified.
import { randomBytes, randomUUID } from "node:crypto";
import { generateRegistrationOptions, verifyRegistrationResponse, generateAuthenticationOptions, verifyAuthenticationResponse } from "@simplewebauthn/server";

export const CHALLENGE_TTL_MS = 5 * 60_000;
export const MAX_CHALLENGES = 1000;
export const MAX_ACTIVE = 10;
export const REGISTER_PER_DAY = 5;
export const REG_OPTIONS_PER_HOUR = 10; // C3
export const REG_FAILS_PER_HOUR = 10; // C3
export const AUTH_FAILS_PER_HOUR = 10; // per credential → refused for the rest of the hour
export const ALGS = [-8, -7, -257]; // Ed25519, ES256, RS256

/** Feature config from env; null (feature off, fail-closed) unless both are set. */
export function pkConfig(env = process.env) {
  const rpID = (env.FAMILY_PASSKEY_RP_ID ?? "").trim();
  const origins = (env.FAMILY_PASSKEY_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!rpID || !origins.length || !origins.every((o) => /^https:\/\/[a-z0-9.-]+$|^http:\/\/localhost(:\d+)?$/.test(o))) return null;
  return { rpID, origins, rpName: "KARTEL" };
}

export const DEVICE_KINDS = ["iphone", "ipad", "mac", "android", "windows", "linux", "key", "other"];
/** A coarse device family from the User-Agent at registration (the UA itself is not stored) and the transports. */
export function deviceKind(ua = "", transports = []) {
  const u = String(ua);
  if (transports.length && transports.every((t) => ["usb", "nfc", "ble"].includes(t))) return "key";
  if (/iPhone/.test(u)) return "iphone";
  if (/iPad/.test(u)) return "ipad";
  if (/Android/.test(u)) return "android";
  if (/Mac OS X|Macintosh/.test(u)) return "mac";
  if (/Windows/.test(u)) return "windows";
  if (/Linux/.test(u)) return "linux";
  return "other";
}

/** R2: friendly names for a few well-known authenticators (static, no network lookup). */
export const AAGUID_NAMES = {
  "fbfc3007-154e-4ecc-8c0b-6e020557d7bd": "Связка ключей iCloud",
  "ea9b8d66-4d01-1d21-3ce4-b6b48cb575d4": "Google Password Manager",
  "08987058-cadc-4b81-b6e1-30de50dcbe96": "Windows Hello",
  "bada5566-a7aa-401f-bd96-45619a55120d": "1Password",
};
const KIND_RU = { iphone: "iPhone", ipad: "iPad", mac: "Mac", android: "Android", windows: "Windows", linux: "Linux", key: "ключ безопасности", other: "устройство" };
export const kindLabel = (k) => KIND_RU[k] ?? KIND_RU.other;
export function defaultLabel(kind, aaguid) {
  const named = AAGUID_NAMES[aaguid ?? ""];
  return (named ? `${kindLabel(kind)} · ${named}` : `Ключ · ${kindLabel(kind)}`).slice(0, 40);
}
export const cleanLabel = (s) => (typeof s === "string" && s.trim().length >= 1 && s.trim().length <= 40 ? s.trim() : null);

const b64u = (buf) => Buffer.from(buf).toString("base64url");
const fromB64u = (s) => (typeof s === "string" && /^[A-Za-z0-9_-]{1,1400}$/.test(s) ? Buffer.from(s, "base64url") : null);
const hourAgo = (now) => new Date(now.getTime() - 3600_000);

/** Registration, step 1 — for a signed-in person (the site enforces: email-link session, ≤ 15 minutes old). */
export async function registerOptions({ store, cfg, email, displayName, now }) {
  if (await store.pkAttempts(email, "reg_options", hourAgo(now)) >= REG_OPTIONS_PER_HOUR) return { error: "rate_limited", status: 429 };
  await store.pkAttempt(email, "reg_options", now);
  const active = await store.pkList(email);
  if (active.length >= MAX_ACTIVE) return { error: "too_many", status: 409 };
  if (await store.pkCreatedSince(email, new Date(now.getTime() - 86400_000)) >= REGISTER_PER_DAY) return { error: "too_many_today", status: 429 };
  const user = (await store.pkUser(email)) ?? (await store.pkAddUser(email, randomBytes(32)));
  const options = await generateRegistrationOptions({
    rpName: cfg.rpName, rpID: cfg.rpID, userName: email, userID: new Uint8Array(user.user_handle), userDisplayName: displayName || email,
    attestationType: "none", supportedAlgorithmIDs: ALGS, timeout: CHALLENGE_TTL_MS,
    authenticatorSelection: { residentKey: "required", userVerification: "required" },
    excludeCredentials: active.map((k) => ({ id: b64u(k.credential_id), transports: k.transports })),
  });
  const id = randomUUID();
  await store.pkChallengePrune(now, MAX_CHALLENGES - 1);
  await store.pkChallengeAdd({ id, purpose: "register", email, challenge: options.challenge, expires_at: new Date(now.getTime() + CHALLENGE_TTL_MS) });
  return { challenge_id: id, options };
}

/** Registration, step 2. Writes the key and queues the «добавлен новый ключ» notice (C1). */
export async function registerVerify({ store, cfg, email, challengeId, response, ua, now }) {
  if (await store.pkAttempts(email, "reg_fail", hourAgo(now)) >= REG_FAILS_PER_HOUR) return { error: "rate_limited", status: 429 };
  const fail = async () => { await store.pkAttempt(email, "reg_fail", now); return { error: "failed", status: 400 }; };
  const c = typeof challengeId === "string" ? await store.pkChallengeTake(challengeId, "register", email, now) : null;
  if (!c || !response || typeof response !== "object") return fail();
  let v;
  try {
    v = await verifyRegistrationResponse({ response, expectedChallenge: c.challenge, expectedOrigin: cfg.origins, expectedRPID: cfg.rpID, requireUserVerification: true, supportedAlgorithmIDs: ALGS });
  } catch { return fail(); }
  if (!v.verified || !v.registrationInfo?.userVerified) return fail();
  const info = v.registrationInfo, cred = info.credential;
  const credId = fromB64u(cred.id);
  if (!credId || (await store.pkByCredential(credId))) return fail();
  const transports = (cred.transports ?? []).filter((t) => /^[a-z-]{2,16}$/.test(t)).slice(0, 6);
  const kind = deviceKind(ua, transports);
  const id = randomUUID();
  await store.pkAdd({ id, email, credential_id: credId, public_key: Buffer.from(cred.publicKey), counter: cred.counter ?? 0, transports, aaguid: /^[0-9a-f-]{36}$/.test(info.aaguid ?? "") ? info.aaguid : null,
    device_kind: kind, device_type: info.credentialDeviceType === "multiDevice" ? "multiDevice" : "singleDevice", backed_up: Boolean(info.credentialBackedUp), label: defaultLabel(kind, info.aaguid) }, email);
  await store.noticeAdd({ kind: "new_key", email, device_kind: kind, on_date: now.toISOString().slice(0, 10) });
  return { id };
}

/** Sign-in, step 1 — no email in, the same answer for everyone. */
export async function authOptions({ store, cfg, now }) {
  const options = await generateAuthenticationOptions({ rpID: cfg.rpID, userVerification: "required", allowCredentials: [], timeout: CHALLENGE_TTL_MS });
  const id = randomUUID();
  await store.pkChallengePrune(now, MAX_CHALLENGES - 1);
  await store.pkChallengeAdd({ id, purpose: "auth", email: null, challenge: options.challenge, expires_at: new Date(now.getTime() + CHALLENGE_TTL_MS) });
  return { challenge_id: id, options };
}

/**
 * Sign-in, step 2. Returns { email } or { error }. The caller must still re-check the allowlist / gate before minting
 * a session. A counter that did not move forward — after a VALID signature — flags the key (refused until cleared)
 * and queues the «подозрительный ключ» notice; nothing is auto-revoked.
 */
export async function authVerify({ store, cfg, challengeId, response, now }) {
  const no = { error: "failed", status: 401 };
  const c = typeof challengeId === "string" ? await store.pkChallengeTake(challengeId, "auth", null, now) : null;
  if (!c || !response || typeof response !== "object") return no;
  const credId = fromB64u(response.id);
  const key = credId ? await store.pkByCredential(credId) : null;
  if (!key || key.revoked_at || key.flagged_at) return no;
  if (await store.pkAttempts(key.id, "auth_fail", hourAgo(now)) >= AUTH_FAILS_PER_HOUR) return no;
  const user = await store.pkUser(key.email);
  const handle = fromB64u(response.response?.userHandle);
  if (!user || !handle || Buffer.compare(handle, Buffer.from(user.user_handle)) !== 0) { await store.pkAttempt(key.id, "auth_fail", now); return no; }
  let v;
  try {
    v = await verifyAuthenticationResponse({ response, expectedChallenge: c.challenge, expectedOrigin: cfg.origins, expectedRPID: cfg.rpID, requireUserVerification: true,
      credential: { id: b64u(key.credential_id), publicKey: new Uint8Array(key.public_key), counter: 0, transports: key.transports } });
  } catch { await store.pkAttempt(key.id, "auth_fail", now); return no; }
  if (!v.verified || !v.authenticationInfo.userVerified) { await store.pkAttempt(key.id, "auth_fail", now); return no; }
  const stored = Number(key.counter), next = Number(v.authenticationInfo.newCounter);
  if ((stored > 0 || next > 0) && next <= stored) {
    if (await store.pkFlag(key.id)) await store.noticeAdd({ kind: "flagged", email: key.email, device_kind: key.device_kind, on_date: now.toISOString().slice(0, 10) });
    return no;
  }
  await store.pkTouch(key.id, next, Boolean(v.authenticationInfo.credentialBackedUp));
  return { email: key.email };
}

/** The list a viewer gets: no credential id, no public key, dates only. */
export const keyView = (k) => ({
  id: k.id, label: k.label, kind: k.device_kind, synced: Boolean(k.backed_up) || k.device_type === "multiDevice",
  created_on: new Date(k.created_at).toISOString().slice(0, 10), last_used_on: k.last_used_at ? new Date(k.last_used_at).toISOString().slice(0, 10) : null, flagged: Boolean(k.flagged_at),
});
