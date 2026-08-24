# Contributing

Thanks for your interest in litewrite-atproto.

## Status

This project is early-stage — see [`PLAN.md`](PLAN.md) for the implementation plan and
[`docs/brief.md`](docs/brief.md) for the full project brief before proposing larger changes.

## Getting set up

```sh
npm install
npm run dev
```

This starts the Express BFF and the Vite dev server together. See [`README.md`](README.md)
for the architecture and deployment notes.

## Before opening a pull request

Run the checks the CI/review process expects to pass:

```sh
npm run typecheck
npm run lint
```

## Making changes

- Keep pull requests focused on a single change.
- Reference the issue your change addresses, if any (e.g. `Fixes #123`).
- If you hit friction with the atproto SDK or other dependencies, consider logging it in
  [`FRICTION.md`](FRICTION.md).

## License

By contributing, you agree that your contributions will be licensed under the project's
[MIT License](LICENSE).
