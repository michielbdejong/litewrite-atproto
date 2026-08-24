-- Initial schema for the three server-owned stores.
--
-- These back the OAuth flow and the browser session. The atproto SDK reads and
-- writes `oauth_state` and `oauth_session` through the StateStore/SessionStore
-- interfaces (wired up in M1); `browser_session` maps an opaque cookie id to the
-- authenticated account DID. Token material lives inside `oauth_session.session`
-- and is treated as a secret: never logged, never sent to the browser.

CREATE TABLE IF NOT EXISTS oauth_state (
  key        text PRIMARY KEY,
  state      jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS oauth_session (
  key        text PRIMARY KEY,       -- the account DID
  session    jsonb NOT NULL,         -- atproto DPoP session (secret)
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS browser_session (
  id         text PRIMARY KEY,       -- random, opaque; stored in the HTTP-only cookie
  did        text NOT NULL,          -- authenticated account DID
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS browser_session_did_idx ON browser_session (did);
