# Coding standards

Read at review time. Every rule here is a judgement call. Layout and naming rules that can be checked by a machine live
in `.claude/rules/` and the linters, so they're not repeated here.

## All TypeScript (apps/api, apps/web, packages/*)

### Scope

- Every new export has a caller in the same change. A ticket naming a helper or component states a need, not a file to
  make. Clients, wrappers and endpoint maps arrive with their first caller.
- A function called once whose only job is to hold a callback's body (a validator, an `onSuccess`) is written inline in
  that callback instead.
- A component or function that only fixes some props or arguments of another is written out at its call sites instead.
  It earns its own name when it adds behaviour.

### Types and data

- Every function declares its parameter and return types; a shape used twice gets a named type.
- Wrap a primitive that stands for a domain concept in its own type.
- A type mirroring a Prisma model or enum derives from `ModelRow<'Model'>` (`ModelRow<'User'>['role']`,
  `Pick`/`Omit<ModelRow<'User'>, …>`), imported from `@repo/prisma` where it's used. Keep the column's name.
- Mark data that doesn't change `readonly`, and literal tables `as const`.
- Numbers with meaning are named constants (limits, windows, lengths). Tests may pin literal values on purpose: flag
  only a test literal that silently duplicates a constant the test is about.

### Functions

- One purpose each, roughly under 20 statements, at one level of abstraction.
- Name starts with a verb. Boolean-returning: `isX` / `hasX` / `canX`. Boolean variables read the same way.
- Prefer early returns and `map` / `filter` / `reduce` over nested blocks. Arrow functions for one-liners, named
  functions otherwise.
- Default parameter values rather than `null` / `undefined` checks.
- An object a function computes (a form validator's result, a mapper's output) reads at a glance. A short ternary for a
  key is fine. When a key's condition takes a second read, build the object with `if`s and one final `return`, and leave
  a key out instead of setting it to `undefined`.
- Complete words, not abbreviations, except standard ones (`API`, `URL`, `i`, `j`, `err`, `ctx`, and `req`, `res`,
  `next` in middleware and guards).

### Classes and modules

- Small, single-purpose classes: under 10 public methods and 10 properties.
- Composition over inheritance. Extending a framework class through its documented hooks (for example NestJS's
  `BaseExceptionFilter`) is fine.
- JSDoc on every exported class, function and public method.

### Exceptions

- Throw for what you don't expect. Catch only to recover from an expected case or to add context; everything else goes
  to the framework's handler (Nest's global handler, the QueryClient's `onError`).

### Tests

- Arrange-Act-Assert (unit) / Given-When-Then (e2e).
- Expected values come from the spec or a known-good literal, never recomputed the way the code computes them.

## apps/web only

- Destructure a hook's result under the names it returns (`const { finishSetup, isBusy, error } = …`). Alias only when
  two names in scope clash (`useLogout`'s `isBusy: isLoggingOut` beside another hook's `isBusy`).
- A pure helper inside a component file is a module-level function that takes component state as parameters
  (`isShowingErrors(meta, hasTriedSubmit)`). The component body holds hooks, event handlers and JSX only.

## apps/api only

- Validate request input in DTO classes, not inside functions.
