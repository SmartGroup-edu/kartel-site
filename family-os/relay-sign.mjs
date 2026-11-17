// The relay's request signature (relay/server.mjs: hex HMAC-SHA256(secret, `${ts}.${rawBody}`)).
import { createHmac } from "node:crypto";
export const sign = (secret, ts, raw) => createHmac("sha256", secret).update(`${ts}.${raw}`).digest("hex");
