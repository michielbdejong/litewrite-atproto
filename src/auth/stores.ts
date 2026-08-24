/**
 * Postgres-backed implementations of the atproto OAuth stores.
 *
 * `@atproto/oauth-client-node` persists two things through `SimpleStore`
 * (`get`/`set`/`del`) interfaces:
 *
 *  - **State store** — short-lived per-authorization-request data, keyed by an
 *    opaque state token, read once on callback.
 *  - **Session store** — the DPoP-bound OAuth session, keyed by the account
 *    DID (`sub`). The SDK reads it to make PDS calls and writes it back on
 *    every token refresh.
 *
 * Both are stored as JSONB. The Node* variants already hold the DPoP key in its
 * serialisable JWK form (`dpopJwk`), so the values round-trip through JSON with
 * no special handling. The session blob contains token material and is treated
 * as a secret: never logged, never sent to the browser.
 */

import type {
  NodeSavedState,
  NodeSavedStateStore,
  NodeSavedSession,
  NodeSavedSessionStore,
} from "@atproto/oauth-client-node";
import { pool } from "../db.js";

export const stateStore: NodeSavedStateStore = {
  async get(key: string): Promise<NodeSavedState | undefined> {
    const { rows } = await pool.query<{ state: NodeSavedState }>(
      "SELECT state FROM oauth_state WHERE key = $1",
      [key],
    );
    return rows[0]?.state;
  },

  async set(key: string, value: NodeSavedState): Promise<void> {
    await pool.query(
      `INSERT INTO oauth_state (key, state) VALUES ($1, $2::jsonb)
       ON CONFLICT (key) DO UPDATE SET state = EXCLUDED.state, created_at = now()`,
      [key, JSON.stringify(value)],
    );
  },

  async del(key: string): Promise<void> {
    await pool.query("DELETE FROM oauth_state WHERE key = $1", [key]);
  },
};

export const sessionStore: NodeSavedSessionStore = {
  async get(sub: string): Promise<NodeSavedSession | undefined> {
    const { rows } = await pool.query<{ session: NodeSavedSession }>(
      "SELECT session FROM oauth_session WHERE key = $1",
      [sub],
    );
    return rows[0]?.session;
  },

  async set(sub: string, value: NodeSavedSession): Promise<void> {
    await pool.query(
      `INSERT INTO oauth_session (key, session) VALUES ($1, $2::jsonb)
       ON CONFLICT (key) DO UPDATE SET session = EXCLUDED.session, updated_at = now()`,
      [sub, JSON.stringify(value)],
    );
  },

  async del(sub: string): Promise<void> {
    await pool.query("DELETE FROM oauth_session WHERE key = $1", [sub]);
  },
};
