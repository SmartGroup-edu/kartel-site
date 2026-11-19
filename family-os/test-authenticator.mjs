// TEST ONLY — a minimal software WebAuthn authenticator (P-256, "none" attestation) for the passkey tests.
// It produces the same JSON a browser hands to the site, so @simplewebauthn/server verifies it for real.
import { createHash, generateKeyPairSync, randomBytes, sign } from "node:crypto";

const b64u = (b) => Buffer.from(b).toString("base64url");
const sha256 = (b) => createHash("sha256").update(b).digest();

// ---- tiny CBOR encoder: unsigned/negative ints, byte strings, text strings, maps
function head(major, n) {
  if (n < 24) return Buffer.from([(major << 5) | n]);
  if (n < 256) return Buffer.from([(major << 5) | 24, n]);
  if (n < 65536) { const b = Buffer.alloc(3); b[0] = (major << 5) | 25; b.writeUInt16BE(n, 1); return b; }
  const b = Buffer.alloc(5); b[0] = (major << 5) | 26; b.writeUInt32BE(n, 1); return b;
}
function cbor(v) {
  if (typeof v === "number") return v >= 0 ? head(0, v) : head(1, -1 - v);
  if (Buffer.isBuffer(v)) return Buffer.concat([head(2, v.length), v]);
  if (typeof v === "string") { const b = Buffer.from(v, "utf8"); return Buffer.concat([head(3, b.length), b]); }
  if (v instanceof Map) return Buffer.concat([head(5, v.size), ...[...v].flatMap(([k, x]) => [cbor(k), cbor(x)])]);
  throw new Error("cbor: unsupported");
}

export function softAuthenticator({ origin, rpID, uv = true, aaguid = Buffer.alloc(16), backup = false }) {
  const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  const jwk = publicKey.export({ format: "jwk" });
  const credId = randomBytes(32);
  let counter = 0, handle = null;
  const flags = (at) => 0x01 | (uv ? 0x04 : 0) | (backup ? 0x08 | 0x10 : 0) | (at ? 0x40 : 0);
  const rpHash = sha256(Buffer.from(rpID));
  const ctr = (n) => { const b = Buffer.alloc(4); b.writeUInt32BE(n, 0); return b; };
  return {
    credId,
    setCounter(n) { counter = n; },
    /** navigator.credentials.create() → RegistrationResponseJSON */
    register(options, { originOverride } = {}) {
      handle = Buffer.from(options.user.id, "base64url");
      const clientData = Buffer.from(JSON.stringify({ type: "webauthn.create", challenge: options.challenge, origin: originOverride ?? origin, crossOrigin: false }));
      const cose = cbor(new Map([[1, 2], [3, -7], [-1, 1], [-2, Buffer.from(jwk.x, "base64url")], [-3, Buffer.from(jwk.y, "base64url")]]));
      const len = Buffer.alloc(2); len.writeUInt16BE(credId.length, 0);
      const authData = Buffer.concat([rpHash, Buffer.from([flags(true)]), ctr(counter), Buffer.from(aaguid), len, credId, cose]);
      const att = cbor(new Map([["fmt", "none"], ["attStmt", new Map()], ["authData", authData]]));
      return { id: b64u(credId), rawId: b64u(credId), type: "public-key", authenticatorAttachment: "platform", clientExtensionResults: {},
        response: { clientDataJSON: b64u(clientData), attestationObject: b64u(att), transports: ["internal", "hybrid"] } };
    },
    /** navigator.credentials.get() → AuthenticationResponseJSON. `bump` advances the signature counter first. */
    assert(options, { bump = 1, originOverride, forgeSignature = false, userHandle } = {}) {
      counter += bump;
      const clientData = Buffer.from(JSON.stringify({ type: "webauthn.get", challenge: options.challenge, origin: originOverride ?? origin, crossOrigin: false }));
      const authData = Buffer.concat([rpHash, Buffer.from([flags(false)]), ctr(counter)]);
      const sig = forgeSignature ? randomBytes(70) : sign("sha256", Buffer.concat([authData, sha256(clientData)]), privateKey);
      return { id: b64u(credId), rawId: b64u(credId), type: "public-key", clientExtensionResults: {}, authenticatorAttachment: "platform",
        response: { clientDataJSON: b64u(clientData), authenticatorData: b64u(authData), signature: b64u(sig), userHandle: b64u(userHandle ?? handle) } };
    },
  };
}
