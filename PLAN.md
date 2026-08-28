# Implementation plan — litewrite on AT Protocol

This is the working plan derived from [`docs/brief.md`](docs/brief.md). The brief is the
source of truth for *why*; this file is the source of truth for *how* and *in what order*.

## Confirmed shape

- **One deployable**: an Express + TypeScript server that (a) serves the built React app as
  static files and (b) exposes the BFF API. Single origin, single Heroku app, single domain
  you own. No separate frontend host — this keeps the session cookie same-origin and avoids
  CORS entirely.
- **Postgres** for three stores, all owned by the server: OAuth `stateStore`, OAuth
  `sessionStore` (atproto DPoP sessions), and the browser session store (cookie → account DID).
- **Deploy target**: Heroku, Postgres add-on, custom domain with TLS. The public HTTPS origin
  is the OAuth `client_id` base.
- **Division of labour**: Claude writes the code and we review it together in this repo; you
  own publishing — pushing the lexicon, registering the domain, deploying to Heroku, and
  running the live OAuth tests against real PDSes.

## Repository layout (target)

```
litewrite-atproto/
├── docs/
│   └── brief.md                # the original brief, verbatim
├── lexicons/
│   └── com/michielbdejong/litewrite/note.json
├── src/                        # Express BFF (TypeScript)
│   ├── index.ts                # server entry, static serving, route wiring
│   ├── env.ts                  # typed, validated environment config
│   ├── db.ts                   # pg pool + migrations runner
│   ├── auth/
│   │   ├── client.ts           # NodeOAuthClient construction
│   │   ├── stores.ts           # StateStore + SessionStore backed by Postgres
│   │   └── session.ts          # browser cookie session (iron-session or signed cookie)
│   ├── routes/
│   │   ├── oauth.ts            # /client-metadata.json, /jwks.json, /login, /oauth/callback, /logout
│   │   └── api.ts             # /api/me, /api/notes (CRUD)
│   └── lexicon/                # `lex`-generated types (checked in)
├── web/                        # React + Vite + TS frontend
│   ├── index.html
│   └── src/
├── migrations/                 # SQL migrations for the three stores
├── tests/                      # Playwright
├── .env.example
├── FRICTION.md
├── PLAN.md
└── README.md
```

Frontend and backend are two `package.json`s (npm workspaces) so Vite and the server keep
independent dependency trees. Build step: `vite build` → `web/dist`, which Express serves.

## Data model (Postgres)

Three tables, created by an idempotent migration on boot:

- `oauth_state (key text primary key, state jsonb, created_at timestamptz)` — short-lived,
  used across the authorize→callback hop.
- `oauth_session (key text primary key, session jsonb, updated_at timestamptz)` — the atproto
  DPoP session keyed by DID; the SDK reads/writes this to refresh tokens.
- `browser_session` — handled by the cookie session library; if server-side, one row keyed by
  a random session id mapping to the account DID.

The atproto `session` blob holds token material, so it is treated as a secret: never logged,
never returned to the browser.

## Auth flow (the part reviewers care about)

`@atproto/oauth-client-node`'s `NodeOAuthClient`, confidential client:

1. `clientMetadata` served at `GET /client-metadata.json`; `client_id` is that URL.
2. Keys: ES256 / P-256 keypair, private JWK from env, public set served at `GET /jwks.json`.
3. `GET /login?handle=…` → `client.authorize(handle, { scope })` → 302 to the PDS auth server.
4. `GET /oauth/callback` → `client.callback(params)` → yields `{ session }`; we set an
   HTTP-only, `SameSite=Lax`, `Secure` cookie carrying the account DID, then redirect to `/`.
5. Authenticated API calls: `client.restore(did)` → `new Agent(session)` → PDS call. The Agent
   handles DPoP and token refresh transparently; refreshed tokens flow back into `oauth_session`.
6. `POST /api/logout` → `session.signOut()` / revoke + clear cookie.

**Scopes**: request `atproto repo:com.michielbdejong.litewrite.note` (narrow to `?action=` if the
syntax supports it at build time — to be verified against current docs, logged in FRICTION.md).
The resulting consent screen is the money screenshot for the write-up.

## Product decision — notes are public (resolves issue #4)

Base atproto has no private record: a repo is a public, signed structure, and any record
is world-readable by DID over unauthenticated endpoints. Our write scope governs *writes
through this app*, not reads. So "private notes" isn't a property the storage layer can
offer without permissioned data (proposal 0016 — experimental, out of scope per the brief).

Decision: **embrace public.**

- litewrite-atproto is a *public* writing app. The UI says so plainly (not fine print) —
  this is what turns a would-be "data is public but the UI implies private" security bug
  into an honest product.
- Keep our own lexicon `com.michielbdejong.litewrite.note` (preserves M2's lexicon +
  codegen story).
- Add a **read-only reader**: view any handle's notes. Small scope, closes the "public
  data you can't read in-app" gap, and exercises cross-PDS reads (which the brief wants to
  show off).
- Autosave writes are public versions (a draft is public from keystroke one). We accept
  this for now with honest save-state copy ("saved — and public"); an explicit-Publish
  variant is noted as a considered alternative for the write-up.

## Milestone execution order

Mirrors the brief, plus the reader from the decision above. Each lands as its own
reviewable set of commits.

- **M0 — scaffolding** *(not in brief, prerequisite)*: workspaces, tsconfig (strict), Express
  hello-world serving a Vite build, Postgres connection + migration runner, `.env.example`,
  `env.ts` validation. Nothing atproto yet. Green `npm run build` + `npm run dev`.
- **M1 — OAuth round trip**: the five routes above. Login with a handle, land authenticated,
  cookie set, `/api/me` renders profile. Manual test plan for both `bsky.social` and
  `bsky.michielbdejong.com`. Logout revokes.
- **M2 — Records**: publish lexicon, `lex` codegen into `src/lexicon/`, CRUD in `/api/notes`
  using `Agent.com.atproto.repo.*`. Verify records land with an independent tool
  (`goat`/`atproto-repo` browser).
- **M2.5 — Reader** *(from the issue #4 decision)*: read-only `GET /api/notes?actor=<handle>`
  and a `/read/:handle` view. Cross-PDS reads via an unauthenticated `Agent`. Small.
- **M3 — Editor** *(done)*: React note list + editor, 800ms debounced autosave, optimistic
  list updates, explicit save-state indicator ("Saved · public"), token-expiry-mid-edit handled
  without text loss (draft mirrored to localStorage + re-login that restores it). Verified by
  driving the built SPA in Chromium with a mocked API.
- **M4 — States & polish** *(partly in M3)*: loading / empty / error / session-expired and
  responsive single-pane phone layout landed with M3. Remaining: offline handling, keyboard-nav
  polish, and a visual-direction pass.
- **M5 — Tests & deploy**: Playwright (OAuth round trip + note CRUD), GitHub Actions CI, Heroku
  deploy at stable URL, README (architecture, why BFF, remoteStorage lineage, run instructions).
- **M6 — Write-up**: blog post + a small number of high-quality upstream issues/PRs distilled
  from FRICTION.md.

## Open questions to resolve before/while coding

Tracked here and in FRICTION.md as they're answered against current docs:

1. **Granular scope syntax** — *(open)* exact string the auth server accepts, incl. any
   `?action=` qualifier and its default. Couldn't be pinned from docs (see FRICTION.md);
   using `atproto repo:com.michielbdejong.litewrite.note`, to be confirmed against the live
   auth server + consent screen at deploy.
2. **Browser session library** — *(resolved, M1)* `iron-session` stateless encrypted cookie
   holding only the DID; no server-side row. `browser_session` table dropped (migration 002).
   Revocation happens at the token layer via `client.revoke(did)`.
3. **`lex` package name / invocation** — *(resolved, M2)* `@atproto/lex` (runtime `l` helper)
   + `@atproto/lex-cli` (`lex build --lexicons ./lexicons --out ./src/lexicon`). Generated
   files are checked in; regenerate with `npm run lexgen`. Note: `build()` injects `$type`
   only — validate with `check()` (see FRICTION.md). `exactOptionalPropertyTypes` dropped for
   compatibility with the generated code.
4. **Heroku specifics you own** — domain name, `DATABASE_URL` SSL mode, dyno type. You confirm
   when we get to M5.
5. **Local OAuth dev on-ramp** — *(open)* confidential `client_id` needs HTTPS + non-IP host,
   so local testing needs a tunnel. A bare-loopback client is a separate construction we
   haven't wired; decide whether it's worth adding (see FRICTION.md).

## Quality gates (every milestone)

- TypeScript `strict`, no `any` in app code.
- No secrets committed; `.env.example` stays current.
- Commits tell a story — small, titled, explained.
- FRICTION.md updated in the same commit as the friction, not retrofitted.
