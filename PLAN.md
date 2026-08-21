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

## Milestone execution order

Mirrors the brief. Each lands as its own reviewable set of commits.

- **M0 — scaffolding** *(not in brief, prerequisite)*: workspaces, tsconfig (strict), Express
  hello-world serving a Vite build, Postgres connection + migration runner, `.env.example`,
  `env.ts` validation. Nothing atproto yet. Green `npm run build` + `npm run dev`.
- **M1 — OAuth round trip**: the five routes above. Login with a handle, land authenticated,
  cookie set, `/api/me` renders profile. Manual test plan for both `bsky.social` and
  `bsky.michielbdejong.com`. Logout revokes.
- **M2 — Records**: publish lexicon, `lex` codegen into `src/lexicon/`, CRUD in `/api/notes`
  using `Agent.com.atproto.repo.*`. Verify records land with an independent tool
  (`goat`/`atproto-repo` browser).
- **M3 — Editor**: React note list + editor, debounced autosave, optimistic updates, explicit
  save-state indicator, token-expiry-mid-edit handled without text loss.
- **M4 — States & polish**: loading / empty / error / offline / session-expired; responsive to
  phone width; keyboard navigable; one coherent visual direction.
- **M5 — Tests & deploy**: Playwright (OAuth round trip + note CRUD), GitHub Actions CI, Heroku
  deploy at stable URL, README (architecture, why BFF, remoteStorage lineage, run instructions).
- **M6 — Write-up**: blog post + a small number of high-quality upstream issues/PRs distilled
  from FRICTION.md.

## Open questions to resolve before/while coding

Tracked here and in FRICTION.md as they're answered against current docs:

1. **Granular scope syntax** — exact string the auth server accepts in 2026 (`repo:<nsid>`,
   any `?action=` qualifier). Verify against the OAuth guide, don't trust the brief.
2. **Browser session library** — `iron-session` (stateless signed cookie, no DB row) vs a
   server-side row in Postgres. Leaning `iron-session` for simplicity; decide in M1.
3. **`lex` package name / invocation** — `@atproto/lex-cli` vs `@atproto/lex`; codegen output
   layout. Resolve in M2.
4. **Heroku specifics you own** — domain name, `DATABASE_URL` SSL mode, dyno type. You confirm
   when we get to M5.

## Quality gates (every milestone)

- TypeScript `strict`, no `any` in app code.
- No secrets committed; `.env.example` stays current.
- Commits tell a story — small, titled, explained.
- FRICTION.md updated in the same commit as the friction, not retrofitted.
