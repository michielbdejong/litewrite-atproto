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

## 2026-08-25 — `@atproto/lex` codegen is incompatible with `exactOptionalPropertyTypes`

- **Attempted**: Compile the `lex build` output under a strict tsconfig that
  included `exactOptionalPropertyTypes: true`.
- **Expected**: Generated code compiles under strict settings — it's the newest
  first-party tooling and the brief rewards using it.
- **Happened**: `tsc` errors in the generated `note.defs.ts`: the generated `Main`
  type declares `title?: string` while the `l.object({...})` validator infers
  `title: string | undefined`, and those are incompatible under
  `exactOptionalPropertyTypes`. Since the file is generated (DO NOT EDIT), the
  only fix is to drop that one compiler flag (plain `strict` still holds).
- **Cost**: ~15 min.
- **Prevention**: The generated types should be internally consistent under
  `exactOptionalPropertyTypes` (emit `title?: string | undefined`, or match the
  validator's inference). **Candidate upstream issue** — a small, concrete codegen
  fix, on-message for the team's lexicon-tooling roadmap.

## 2026-08-25 — `RecordSchema.build()` injects `$type` but does not validate

- **Attempted**: Rely on `noteSchema.build({...})` to both construct the record
  and reject invalid input (over-long `text`, etc.) before `putRecord`.
- **Expected**: A `build()` derived from a schema validates against that schema.
- **Happened**: `build()` only injects `$type` — an over-length `text` (100001
  chars vs `maxLength: 100000`) sailed through. Validation lives in the separate
  `check()` / `assert()` / `safeParse()` methods. Caught only by an explicit
  offline test that deliberately fed invalid input.
- **Cost**: ~20 min (writing the test that exposed it, then re-plumbing to call
  `check()` after `build()`).
- **Prevention**: The name `build` implies validation to most readers; either
  validate inside `build()` or document prominently that it does not. A one-liner
  in the `record()` JSDoc ("build() does not validate; use check()/assert()")
  would prevent the wrong assumption. **Candidate upstream doc issue.**

## 2026-08-25 — `assert()` assertion signature trips TS2775 on an imported schema

- **Attempted**: Validate with `noteSchema.assert(record)`.
- **Expected**: Compiles like any method call.
- **Happened**: `error TS2775: Assertions require every name in the call target to
  be declared with an explicit type annotation` — TypeScript's rule for
  assertion-signature methods (`asserts x is T`) accessed via an imported binding.
  Switched to `check()` (throws identically, plain `void` return, no 2775).
- **Cost**: ~10 min.
- **Prevention**: Worth a note in the schema docs that `check()` is the
  ergonomic throwing validator for imported schemas, since `assert()` hits a
  TS limitation in that common case.

## 2026-08-25 — PDS can't validate a not-yet-resolvable custom lexicon

- **Attempted**: Pass `validate: true` to `createRecord`/`putRecord` for
  belt-and-braces server-side validation.
- **Expected**: Straightforward.
- **Happened**: The PDS can only validate lexicons it can resolve; a brand-new
  custom NSID isn't resolvable until published, so `validate: true` is a
  liability during development. Left `validate` unset (PDS validates known
  lexicons only) and do authoritative validation client-side via `check()`.
- **Cost**: ~10 min of reasoning.
- **Prevention**: This is arguably correct behaviour, but the trade-off
  (`true` vs unset vs `false` for an unpublished lexicon) deserves a sentence in
  the records/CRUD guide.

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
