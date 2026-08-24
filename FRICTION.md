# Friction log

Append **as things happen**, not from memory. One entry per snag. Format:

> **Date — short title**
> - **Attempted**: what I was trying to do
> - **Expected**: what I thought would happen
> - **Happened**: what actually happened
> - **Cost**: how long it ate
> - **Prevention**: what doc/error-message/API change would have avoided it

This log is a deliverable (see M6 in [`docs/brief.md`](docs/brief.md)): it distills into a
blog post and a small number of high-quality upstream issues/PRs.

---

<!-- entries below, newest first -->

## 2026-08-24 — `use` on a private JWK is deprecated in favour of `key_ops`

- **Attempted**: Generated the ES256/P-256 signing key and set `use: "sig"` on the
  private JWK (the near-universal JWK convention) before handing it to
  `JoseKey.fromJWK`.
- **Expected**: Accepted silently — `use: "sig"` is standard (RFC 7517) and what most
  JWK tooling emits.
- **Happened**: Runtime warning: *"Private JWK with a 'use' property will be rejected in
  the future. Please remove replace 'use' with (valid) 'key_ops'."* The published
  `/jwks.json` then shows `key_ops: ["verify","encrypt","wrapKey"]` derived automatically.
- **Cost**: ~10 min — surfaced only by reading startup logs on the first real boot.
- **Prevention**: The deprecation message is slightly garbled ("remove replace") and
  points away from a long-standing JWK norm without explaining why `use` is being dropped.
  Documenting the `use`→`key_ops` migration in the oauth-client-node README (its example
  doesn't touch key generation) would have pre-empted it. **Candidate upstream issue.**

## 2026-08-24 — Confidential `client_id` rejects HTTP and IP hosts, with no dev on-ramp

- **Attempted**: Booted the BFF locally with `PUBLIC_URL=http://127.0.0.1:3000`, expecting
  to click through the OAuth UI against a tunnel later.
- **Expected**: Client constructs; only the *live* authorize call would need HTTPS.
- **Happened**: `NodeOAuthClient` construction throws a `ZodError` immediately: *"URL must
  use the 'https:' protocol"* and *"ClientID hostname must not be an IP address"*. The
  server can't even start. The brief's "127.0.0.1 loopback special case" applies to the
  *loopback client* variant (`client_id` = `http://localhost` with metadata as query
  params), which is a different construction path than the confidential client.
- **Cost**: ~20 min to diagnose and decide: local OAuth now requires an HTTPS tunnel; the
  bare-loopback dev flow is a separate client type we haven't wired.
- **Prevention**: The error is accurate but arrives with no pointer to the loopback-client
  escape hatch. A one-line hint ("for local development, use a loopback client — see …")
  in the validation error or README would save the detour. Documented in `.env.example`.

## 2026-08-24 — `requestLock` warning reads as a security alarm

- **Attempted**: Constructed `NodeOAuthClient` without `requestLock` (single dyno; the
  option is documented as optional).
- **Expected**: Silent, or an informational note.
- **Happened**: *"No lock mechanism provided. Credentials might get revoked."* — alarming
  wording for what is a correct, supported single-instance setup. Fix: pass the exported
  `requestLocalLock`.
- **Cost**: ~5 min.
- **Prevention**: The type doc mentions `requestLocalLock` but the runtime warning doesn't
  name it. Echoing "pass `requestLocalLock` to silence this if you run a single instance"
  in the warning would close the loop.

## 2026-08-24 — Granular scope syntax is hard to pin from published sources

- **Attempted**: Confirm the exact granular scope string for write access to one
  collection (`repo:<nsid>`), including any `?action=` qualifier and defaults.
- **Expected**: A canonical, versioned reference for the shipped syntax.
- **Happened**: The proposal (0011) is explicit that "scope string syntax … likely to
  change," while the shipped `@atproto/oauth-scopes` package is the real source of truth —
  but unpkg, jsdelivr, and atproto.com were all unreachable from this environment, so the
  precise action-qualifier serialization couldn't be verified from docs alone. Proceeding
  with `atproto repo:com.michielbdejong.litewrite.note` and will confirm the exact accepted
  string against the live auth server + consent screen during deployment.
- **Cost**: ~30 min of searching; unresolved pending a live test.
- **Prevention**: A short, stable "scopes reference" page enumerating the shipped grammar
  (with the `action` default) — distinct from the evolving proposal — would be the single
  most useful doc for an app author requesting minimal scope. **Candidate upstream issue**,
  and directly on-message given the consent-screen focus of the brief.

## 2026-08-24 — `repo:` scope alone doesn't cover AppView reads

- **Attempted**: Deploy with the scope above and call `agent.getProfile` (via the Bluesky
  AppView) from `/api/me`.
- **Expected**: The `atproto` base scope would be enough for a read of the logged-in
  user's own profile.
- **Happened**: The AppView rejected the call with `ScopeMissingError: Missing required
  scope "rpc:app.bsky.actor.getProfile?aud=did:web:api.bsky.app#bsky_appview"` (issue #8).
  Granular scopes cover XRPC calls per-method-per-audience, not just repo writes — a read
  routed through a service other than the user's own PDS needs its own `rpc:` grant.
- **Fix**: Added that exact `rpc:` scope to the default `OAUTH_SCOPE`. Confirms the syntax
  the previous entry couldn't verify from docs alone.
- **Cost**: One crash loop in production before the log gave the exact string to copy.
- **Prevention**: The scope error message is actually excellent (names the exact string to
  add) — the gap was that nothing in the SDK docs flags that AppView reads need an `rpc:`
  scope distinct from the PDS-side `repo:` one.

## 2026-08-24 — Scope fix alone didn't stop the crash; the real bug was an uncaught XRPCError

- **Attempted**: After adding the `rpc:` scope above and redeploying, the identical
  `ScopeMissingError` still crashed the app (issue #8, reopened).
- **Expected**: A code fix that changes what scope gets *requested* would end the crash.
- **Happened**: It didn't, because OAuth scope is bound to a session at consent time —
  redeploying new code doesn't retroactively broaden a token a user already holds from
  before the fix. Anyone who authorized under the old scope keeps hitting the old error
  until they log out and reconnect (triggering a fresh consent against the now-broader
  `client-metadata.json`). Separately, and more importantly: `/api/me`'s
  `agent.getProfile()` call wasn't wrapped in try/catch, so *any* XRPCError there
  (scope, PDS downtime, a bad handle, anything) was an uncaught rejection in an async
  Express 4 handler — which crashes the entire process, not just that one request. One
  user's stale session took the whole app down for everyone.
- **Fix**: Wrapped the call; a 401/403 (insufficient scope) clears the session and
  returns 401 so the client re-prompts login instead of looping or crashing. Other
  errors return 502 without touching the session, since they may be transient.
- **Cost**: A second, avoidable crash-and-reopen cycle on the same issue.
- **Prevention**: Express 4's async handlers don't catch thrown/rejected errors — this
  is a general hazard, not atproto-specific. Every route that awaits an SDK call needs
  its own try/catch (or an async-wrapper middleware) or a single bad response from any
  upstream service becomes a full outage.
