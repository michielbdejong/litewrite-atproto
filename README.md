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

## Deploying to Heroku

The server validates its configuration at startup (see [`src/env.ts`](src/env.ts)) and
refuses to boot if a required variable is missing, so set these before your first deploy.

1. Create the app and add Postgres:

   ```sh
   heroku create your-app-name
   heroku addons:create heroku-postgresql:essential-0 --app=your-app-name
   ```

   This sets `DATABASE_URL` automatically. Migrations in [`migrations/`](migrations) run
   automatically on every boot (see [`src/db.ts`](src/db.ts)) — no separate migrate step.

2. Generate the OAuth signing key and cookie secret, then set them as config vars:

   ```sh
   npm run keygen
   ```

   Copy the `PRIVATE_JWK` and `COOKIE_SECRET` lines it prints into:

   ```sh
   heroku config:set PRIVATE_JWK='<value from keygen>' --app=your-app-name
   heroku config:set COOKIE_SECRET=<value from keygen> --app=your-app-name
   ```

   Keep both secret — never commit them.

3. Set `PUBLIC_URL` to your app's real HTTPS origin (used to build the OAuth client
   metadata and redirect URIs, so it must match where the app is actually served):

   ```sh
   heroku config:set PUBLIC_URL=https://your-app-name.herokuapp.com --app=your-app-name
   heroku config:set NODE_ENV=production --app=your-app-name
   ```

4. Deploy:

   ```sh
   git push heroku main
   ```

`CLIENT_NAME`, `OAUTH_SCOPE`, `PORT`, and `DATABASE_SSL` all have working defaults and
don't need to be set for a standard Heroku deploy.

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
