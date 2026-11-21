# Workspace packages (`packages/*`)

Every package ships TypeScript source; none has a build step. Each app loads the `.ts` files directly,
so a package has to stay loadable by all three of them.

## Package shape

- `package.json`: `"type": "module"`, `"exports"` pointing at source (`"./*": "./src/*.ts"` or
  `".": "./src/index.ts"`), plus `check-types`, `lint` and `test` scripts so turbo, CI and the
  pre-commit hook pick them up.
- Relative imports keep the `.ts` suffix (`'./api-error.ts'`). Node needs it to load the source at runtime.
- Erasable syntax only (`erasableSyntaxOnly` in the tsconfig): no `enum`, `namespace` or parameter
  properties. Node strips types; it does not compile.
- Types from the database come from `@repo/prisma` (`ModelRow<'User'>`), imported with `import type`.

## How each app loads a package

- **apps/api at runtime** (`node dist/main`): `tsc` leaves the package out of `dist`. Node 24 strips the
  types and loads the ESM package through `require()`. That works because the workspace symlink resolves
  to a real path outside `node_modules`.
- **apps/api tests** (Jest): `ts-jest` compiles the package to CommonJS along with the tests.
- **apps/web** (Next): list the package in `transpilePackages` in `next.config.ts`. The tsconfig needs
  `allowImportingTsExtensions` (allowed because `noEmit` is on) to accept the `.ts` suffixes.

## Adding a package to an app

1. `bun add "@repo/<name>@workspace:*"` in the app.
2. For a Next app, add it to `transpilePackages`.
3. Run the app's `check-types`. For the API, also run `bun run build` and `node -e "require('./dist/main')"`,
   or at least require one built file that imports the package, to confirm Node can load it.
