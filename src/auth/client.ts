/**
 * Constructs the confidential OAuth client.
 *
 * We use the backend-for-frontend (BFF) pattern: a confidential client that
 * authenticates to the auth server with `private_key_jwt` (ES256, P-256) and
 * publishes its public key set at /jwks.json. The `client_id` is the public
 * HTTPS URL that serves the client metadata document.
 *
 * `client_id` must be a publicly reachable HTTPS URL, so this only works fully
 * once deployed (Heroku) or behind a tunnel — see docs/brief.md.
 */

import { NodeOAuthClient, requestLocalLock } from "@atproto/oauth-client-node";
import type { OAuthClientMetadataInput } from "@atproto/oauth-client-node";
import { JoseKey } from "@atproto/jwk-jose";
import { env } from "../env.js";
import { stateStore, sessionStore } from "./stores.js";

const KID = "litewrite-signing-key";

/** Build the client metadata document served at /client-metadata.json. */
export function buildClientMetadata(): OAuthClientMetadataInput {
  const base = env.publicUrl.replace(/\/$/, "");
  return {
    client_id: `${base}/client-metadata.json`,
    client_name: env.oauth.clientName,
    client_uri: base,
    redirect_uris: [`${base}/oauth/callback`],
    scope: env.oauth.scope,
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    application_type: "web",
    token_endpoint_auth_method: "private_key_jwt",
    token_endpoint_auth_signing_alg: "ES256",
    dpop_bound_access_tokens: true,
    jwks_uri: `${base}/jwks.json`,
  };
}

/**
 * Create the OAuth client. Async because importing the signing key is async.
 * Single-process deployment, so `requestLock` is omitted (the SDK warns but it
 * is safe for one instance; revisit if we scale to multiple dynos).
 */
export async function createOAuthClient(): Promise<NodeOAuthClient> {
  const key = await JoseKey.fromJWK(env.oauth.privateJwk, KID);
  return new NodeOAuthClient({
    clientMetadata: buildClientMetadata(),
    keyset: [key],
    stateStore,
    sessionStore,
    // In-process advisory lock around session refreshes. Correct for a single
    // instance; swap for a Postgres/Redis lock if we ever run multiple dynos.
    requestLock: requestLocalLock,
  });
}
