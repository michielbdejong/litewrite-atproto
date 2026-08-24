/**
 * Generate the secrets the OAuth BFF needs and print them as env lines.
 *
 *   node scripts/generate-keys.mjs
 *
 * Produces a private EC P-256 signing key (ES256) as a compact JWK for
 * PRIVATE_JWK, and a random COOKIE_SECRET. Copy the output into your .env
 * (locally) or `heroku config:set` (production). The private key never leaves
 * your machine; only the derived public JWK is published, at /jwks.json.
 */

import { randomBytes } from "node:crypto";
import { JoseKey } from "@atproto/jwk-jose";

const key = await JoseKey.generate(["ES256"], "litewrite-signing-key");
if (!key.privateJwk) {
  throw new Error("Key generation did not produce a private JWK");
}
// Pin `alg` explicitly so the published /jwks.json is unambiguous.
// NB: do NOT add `use` — the SDK deprecates it on private JWKs (see FRICTION.md).
const privateJwk = { ...key.privateJwk, alg: "ES256" };

const cookieSecret = randomBytes(32).toString("hex");

console.log("# Add these to your .env (or set as Heroku config vars).");
console.log("# Keep PRIVATE_JWK and COOKIE_SECRET secret — never commit them.\n");
console.log(`PRIVATE_JWK='${JSON.stringify(privateJwk)}'`);
console.log(`COOKIE_SECRET=${cookieSecret}`);
