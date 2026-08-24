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

export function loadEnv(): Env {
  const nodeEnv = parseNodeEnv(optional("NODE_ENV", "development"));
  return {
    nodeEnv,
    port: parsePort(optional("PORT", "3000")),
    publicUrl: optional("PUBLIC_URL", "http://127.0.0.1:3000"),
    databaseUrl: required("DATABASE_URL"),
    // Default SSL on in production (Heroku Postgres requires it), off locally.
    databaseSsl: parseBool(optional("DATABASE_SSL", nodeEnv === "production" ? "true" : "false")),
  };
}

export const env: Env = loadEnv();
