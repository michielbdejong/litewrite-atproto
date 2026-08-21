# litewrite on AT Protocol

A fast, distraction-free notes editor — a list on the left, an editor on the right — where
your notes live in **your own repository** on the [AT Protocol](https://atproto.com) network,
not in this app's database.

## Lineage

litewrite was one of the ~20 [unhosted](https://unhosted.org) apps built on
**[remoteStorage](https://remotestorage.io)**, a protocol the author wrote in 2010 for
client-side apps backed by a user-controlled server. This is that same app, rebuilt for AT
Protocol in 2026: same product concept — your data, your server — on today's stack.

The original litewrite is credited here; this is a fresh React rebuild, not a port.

## Status

Early. See [`PLAN.md`](PLAN.md) for the implementation plan and [`docs/brief.md`](docs/brief.md)
for the full project brief. Friction encountered with the atproto SDK is logged in
[`FRICTION.md`](FRICTION.md).

## Architecture (planned)

A **backend-for-frontend (BFF)**: a React SPA talks only to an Express server on the same
origin; the Express server holds the OAuth session and talks to the user's PDS on the SPA's
behalf. This is the flow atproto's docs recommend over a browser-only SPA — the backend can
invalidate credentials and the auth server issues longer-lived tokens to a confidential client.

```
browser (React) ──cookie──▶ Express BFF ──Agent (DPoP)──▶ user's PDS
```

Full rationale — why BFF, how OAuth and token refresh work, how to run it — lands here as the
build progresses.
