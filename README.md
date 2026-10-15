# kinesia

A headless toolkit for React. See the [package README](packages/kinesia/README.md) for usage and
API, or try the [live demo](https://kinesia-pearl.vercel.app).

## Repository

| Path                | What                                                                      |
| ------------------- | ------------------------------------------------------------------------- |
| `packages/kinesia`  | The published package: `src/core` (framework-agnostic), `src/react` (hooks) |
| `apps/playground`   | Vite app with live demos, built against the package source                |

Each tool lives in its own module folder, mirrored in `src/core/<module>` and
`src/react/<module>`. Shared plumbing (the frame scheduler, math helpers) lives in
`src/core/internal` and isn't exported.

## Development

Requires Node 20+ and pnpm (the version is pinned in `package.json`).

```sh
pnpm install
pnpm dev         # playground at http://localhost:5173
pnpm test        # vitest
pnpm test:e2e    # playwright, headless against the installed Google Chrome
pnpm typecheck
pnpm lint        # biome; `pnpm format` to fix
pnpm build       # builds packages/kinesia into dist/
```

## Releasing

Releases use [Changesets](https://github.com/changesets/changesets).

1. Add a changeset with each user-facing change: `pnpm changeset`.
2. On `main`, the release workflow opens a "chore: release" pull request that bumps versions and
   updates the changelog.
3. Merging that pull request publishes to npm.

Publishing from CI needs an `NPM_TOKEN` repository secret (a granular npm token with publish
rights), or npm trusted publishing configured for this repository on npmjs.com. The first publish
can also be done locally with `pnpm build && pnpm --filter kinesia publish`.

## License

[MIT](LICENSE)
