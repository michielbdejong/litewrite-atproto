# Project brief — litewrite on AT Protocol

## Why this exists

This is a portfolio piece for a **Senior Fullstack Engineer, Atmosphere** interview at
Bluesky. That team is one fullstack engineer plus two devrels, and their job is building
the atproto **SDK** and the **authorization flow screens**. So this project has to
demonstrate three things, in order:

1. **Fullstack competence, visibly.** Real React on a real Node backend, deployed at a
   real URL. The frontend is the part being assessed most — the author's backend and
   protocol credentials are already established.
2. **Fluent use of their SDK**, on the code path their docs recommend but their own
   example app doesn't show (backend-for-frontend, not SPA).
3. **Developer-experience judgement.** Every rough edge hit along the way gets logged and
   written up. That output *is* half of what this team does.

Narrative hook: the author wrote the **remoteStorage** protocol in 2010 and litewrite was
one of the ~20 "unhosted" apps built on it — client-side app, user-controlled server. This
is that same app on AT Protocol in 2026. Put this in the README.

## Scope discipline

A small app that is genuinely finished, tested and deployed beats a sprawling one.
**Resist feature creep.** If a feature isn't in the milestones below, it's out.

Non-goals: mobile app, real-time collaboration, rich text, sharing/permissions,
firehose consumption, custom feeds, offline-first sync engine.

## Key decision: rebuild, don't port

Do **not** port the legacy litewrite codebase (old JS, IndexedDB, Backbone-era patterns).
Build a fresh React app with the same product concept — a fast, distraction-free notes
editor with a list on the left and an editor on the right. Credit the original in the
README. The point is to show modern React, not to wrestle a 2013 codebase.

## Stack — decided, don't re-litigate

| Layer | Choice | Why |
|---|---|---|
| Frontend | React + Vite + TypeScript | Matches their `social-app` stack. No Next.js — the BFF is explicit here, and a framework would blur it. |
| Backend | Node + Express + TypeScript | Mirrors `statusphere-example-app` so it's legible to them. |
| OAuth | `@atproto/oauth-client-node` | Their docs recommend BFF over SPA: the backend can invalidate credentials at scale, and the auth server issues longer-lived tokens to a BFF. |
| Browser session | HTTP-only session cookie → OAuth session | The documented BFF pattern. |
| PDS calls | `@atproto/api` `Agent` | `new Agent(session)`. |
| Storage | Postgres | For the OAuth state store, session store, and browser sessions. |
| Types | `@atproto/lex` codegen from the lexicon | Lexicon workflows are an active area on their 2026 roadmap; using the newest tooling is worth points. |
| Tests | Playwright | Full OAuth round trip against a real PDS. |

## Read these before writing code

The SDK moves fast and this brief may be stale. **Verify APIs against current docs
rather than trusting the snippets here.**

- https://atproto.com/guides/applications — the Statusphere walkthrough
- https://github.com/bluesky-social/statusphere-example-app — official example
- https://atproto.com/guides/about-oauth
- https://www.npmjs.com/package/@atproto/oauth-client-node — Express example in README
- https://github.com/bluesky-social/atproto/blob/main/packages/api/OAUTH.md
- https://docs.bsky.app/docs/advanced-guides/oauth-client — "the hard way", useful background
- https://atproto.com/blog/2026-spring-roadmap — current priorities

## Architecture

```
browser (React SPA)
  │  session cookie (HTTP-only, SameSite=Lax)
  ▼
Express BFF
  ├── GET  /client-metadata.json     → client.clientMetadata
  ├── GET  /jwks.json                → client.jwks
  ├── GET  /login?handle=…           → client.authorize() → redirect
  ├── GET  /oauth/callback           → client.callback() → set cookie → redirect to app
  ├── POST /api/logout
  ├── GET  /api/me                   → profile via Agent
  ├── GET  /api/notes                → list records
  ├── PUT  /api/notes/:rkey          → put record
  └── DELETE /api/notes/:rkey
  │  Agent (DPoP, auto token refresh)
  ▼
user's PDS  (test against BOTH bsky.social AND the author's own PDS
             at bsky.michielbdejong.com — cross-PDS behaviour is exactly
             what their SDK has to get right, and few applicants can test it)
```

`client_id` must be a public HTTPS URL serving the client metadata JSON. Confidential
clients sign with ES256/P-256 and publish a `jwks_uri`. OAuth requires HTTPS even in
dev — use a tunnel, or the 127.0.0.1 loopback special case.

## Lexicon

NSID under a domain the author controls: **`com.michielbdejong.litewrite.note`**

Record shape (keep it minimal):

```json
{
  "lexicon": 1,
  "id": "com.michielbdejong.litewrite.note",
  "defs": {
    "main": {
      "type": "record",
      "key": "tid",
      "record": {
        "type": "object",
        "required": ["text", "createdAt"],
        "properties": {
          "text":      { "type": "string", "maxLength": 100000 },
          "title":     { "type": "string", "maxLength": 300 },
          "createdAt": { "type": "string", "format": "datetime" },
          "updatedAt": { "type": "string", "format": "datetime" }
        }
      }
    }
  }
}
```

Publish the lexicon so it resolves, and generate types with `lex`.

## Scopes — request the minimum

Do **not** ask for blanket `atproto`. Use granular scopes:

```
atproto repo:com.michielbdejong.litewrite.note rpc:app.bsky.actor.getProfile?aud=did:web:api.bsky.app#bsky_appview
```

The trailing `rpc:` scope is required for the one AppView call the BFF makes (`/api/me`
reads the profile via `agent.getProfile`) — without it the AppView rejects the call with
`ScopeMissingError` even though the PDS-side repo scope is fine (see FRICTION.md).

Narrow further with `?action=` if the syntax supports it at time of writing. This is a
deliberate signal: the author co-authored an IETF draft on fine-grained consent
(`draft-vandermeulen-oauth-resource-helper`), and this team builds the consent screens.
**Screenshot the resulting consent screen for the write-up** — showing that a narrow scope
produces a comprehensible consent prompt is the single most on-message artifact here.

## Milestones

Roughly one evening each. Each must be genuinely done before moving on.

**M1 — OAuth round trip.** Log in with a handle, land back authenticated, session cookie
set, profile rendered. Works against bsky.social *and* the author's own PDS. Logout
revokes cleanly.

**M2 — Records.** Lexicon defined and published, types generated. Create, list, read,
update, delete notes as records in the user's repo. Verify with an independent tool that
records land correctly.

**M3 — The editor.** Note list + editor. Autosave with debounce, optimistic updates,
clear save-state indicator. Handles the token-expiry-mid-edit case without losing text.

**M4 — States and polish.** Loading, empty, error, offline, session-expired. Responsive
down to phone width. Keyboard navigable. One coherent visual direction, applied
consistently. *A reviewer judges frontend ability in about four seconds of looking at
the deployed URL — this milestone is not optional.*

**M5 — Tests and deploy.** Playwright covering the OAuth round trip and note CRUD. CI on
GitHub Actions. Deployed at a stable public URL. README explaining architecture, the BFF
choice, the remoteStorage lineage, and how to run it.

**M6 — Write-up.** See below.

## Friction log — maintain from minute one

Keep `FRICTION.md` in the repo and append to it **as things happen**, not from memory at
the end. For each: what was attempted, what was expected, what happened, how long it cost,
what would have prevented it.

Watch especially for:
- BFF path underdocumented relative to the SPA path
- Scope syntax that isn't obvious from the docs
- Anything that behaves differently against a non-`bsky.social` PDS
- Lexicon publishing and `lex` codegen ergonomics
- Error messages that don't say what to do next
- Anything needing a tunnel, a workaround, or a StackOverflow detour

This becomes M6: a blog post plus a small number of **well-formed issues or PRs** on
`bluesky-social/atproto`. Quality over volume — their CONTRIBUTING notes they prioritise
high-quality issues and have limited review bandwidth. Two good issues beat ten thin ones.

## Quality bar

- TypeScript strict. No `any` in app code.
- No secrets in the repo. `.env.example` committed.
- Commits tell a story — this repo will be read by the people who wrote the SDK.
- README is a first-class deliverable: architecture diagram, why BFF, how to run,
  what was learned.
- Handle token refresh, DPoP and session invalidation properly. Don't paper over auth
  failures with a redirect to login and no explanation.

## Definition of done

A stranger can open the public URL, log in with any atproto handle including one on a
self-hosted PDS, write a note, reload, and see it. The repo explains itself. `FRICTION.md`
has real content. At least one issue or PR is filed upstream.
