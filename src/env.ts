/**
 * Typed, validated environment configuration.
 *
 * Every environment variable the server reads is declared here and validated
 * once at startup, so the rest of the code can import a fully-typed `env`
 * object and never touch `process.env` directly. A missing or malformed
 * required variable fails fast with a clear message instead of surfacing as a
 * confusing runtime error deep in a request handler.
 */

type NodeEnv = "development" | "production" | "test";

export interface Env {
  readonly nodeEnv: NodeEnv;
  readonly port: number;
  /** Public HTTPS origin of the deployed app, e.g. https://litewrite.example.com. */
  readonly publicUrl: string;
  /** Postgres connection string (Heroku provides this as DATABASE_URL). */
  readonly databaseUrl: string;
  /** Whether to require TLS for the Postgres connection (true on Heroku). */
  readonly databaseSsl: boolean;
  readonly oauth: OAuthEnv;
}

export interface OAuthEnv {
  /** Human-readable client name shown on the consent screen. */
  readonly clientName: string;
  /**
   * OAuth scope string. Base `atproto` scope plus a granular repo scope for
   * our single record collection — deliberately narrow (see docs/brief.md).
   */
  readonly scope: string;
  /**
   * The confidential client's signing key, as a private EC P-256 JWK (JSON).
   * Used for `private_key_jwt` client authentication (ES256). The matching
   * public JWK is published at /jwks.json. Generate with `npm run keygen`.
   */
  readonly privateJwk: Record<string, unknown>;
  /** Secret for encrypting the browser session cookie (iron-session), >= 32 chars. */
  readonly cookieSecret: string;
}

function required(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optional(name: string, fallback: string): string {
  const value = process.env[name];
  return value === undefined || value === "" ? fallback : value;
}

function parsePort(raw: string): number {
  const port = Number.parseInt(raw, 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid PORT: ${raw}`);
  }
  return port;
}

function parseNodeEnv(raw: string): NodeEnv {
  if (raw === "development" || raw === "production" || raw === "test") {
    return raw;
  }
  throw new Error(`Invalid NODE_ENV: ${raw} (expected development|production|test)`);
}

function parseBool(raw: string): boolean {
  return raw === "true" || raw === "1";
}

/** Parse the private signing key from JSON, validating it is a P-256 EC key. */
function parsePrivateJwk(raw: string): Record<string, unknown> {
  let jwk: Record<string, unknown>;
  try {
    jwk = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new Error("PRIVATE_JWK is not valid JSON (expected a private EC P-256 JWK). Run `npm run keygen`.");
  }
  if (jwk["kty"] !== "EC" || jwk["crv"] !== "P-256" || typeof jwk["d"] !== "string") {
    throw new Error("PRIVATE_JWK must be a private EC P-256 JWK (kty=EC, crv=P-256, with a `d` value).");
  }
  return jwk;
}

function loadOAuthEnv(): OAuthEnv {
  const cookieSecret = required("COOKIE_SECRET");
  if (cookieSecret.length < 32) {
    throw new Error("COOKIE_SECRET must be at least 32 characters.");
  }
  return {
    clientName: optional("CLIENT_NAME", "litewrite"),
    // Base OAuth scope + a granular repo scope for our one collection, plus the
    // rpc scope for the one AppView call we make (`/api/me` reads the profile).
    // Without it the PDS mints a token the Bluesky AppView rejects with
    // ScopeMissingError (see FRICTION.md).
    scope: optional(
      "OAUTH_SCOPE",
      "atproto repo:com.michielbdejong.litewrite.note rpc:app.bsky.actor.getProfile?aud=did:web:api.bsky.app#bsky_appview",
    ),
    privateJwk: parsePrivateJwk(required("PRIVATE_JWK")),
    cookieSecret,
  };
}

export function loadEnv(): Env {
  const nodeEnv = parseNodeEnv(optional("NODE_ENV", "development"));
  return {
    nodeEnv,
    port: parsePort(optional("PORT", "3000")),
    publicUrl: optional("PUBLIC_URL", "http://127.0.0.1:3000"),
    databaseUrl: required("DATABASE_URL"),
    // Default SSL on in production (Heroku Postgres requires it), off locally.
    databaseSsl: parseBool(optional("DATABASE_SSL", nodeEnv === "production" ? "true" : "false")),
    oauth: loadOAuthEnv(),
  };
}

export const env: Env = loadEnv();
