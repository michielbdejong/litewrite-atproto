# Contributing

Thanks for your interest in litewrite-atproto. This project is early-stage — see
[`README.md`](README.md) for the current status and [`PLAN.md`](PLAN.md) for the
implementation plan.

## Getting started

```sh
npm install
cp .env.example .env   # fill in required values
npm run dev
```

`npm run dev` runs the Express server and the React SPA concurrently. See
[`README.md`](README.md) for deployment instructions and required environment variables.

## Before opening a pull request

Run the following and fix anything they catch:

```sh
npm run typecheck
npm run lint
```

## Pull requests

- Keep changes focused; avoid bundling unrelated fixes.
- Reference the issue your PR addresses, if any (e.g. "Fixes #123").
- Describe *why* a change is needed, not just what it does — this matters especially for
  design and architecture decisions.

## Reporting issues

Open a GitHub issue with as much detail as you can: what you expected, what happened
instead, and steps to reproduce.
