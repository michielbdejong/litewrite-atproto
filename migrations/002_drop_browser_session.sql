-- We settled the M0 open question in favour of a stateless, encrypted browser
-- cookie (iron-session) rather than a server-side browser-session row: the
-- cookie holds only the account DID, and credential revocation happens at the
-- token layer via client.revoke(did). So the browser_session table is dead
-- weight — drop it. (The oauth_state and oauth_session tables remain.)

DROP INDEX IF EXISTS browser_session_did_idx;
DROP TABLE IF EXISTS browser_session;
