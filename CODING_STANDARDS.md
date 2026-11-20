# Coding standards

Read at review time. Every rule here is a judgement call. Layout and naming rules that can be checked by a
machine live in `.claude/rules/` and the linters, so they're not repeated here.

## apps/api (TypeScript, NestJS)

### Types and data

- Every function declares its parameter and return types; a shape used twice gets a named type.
- Wrap a primitive that stands for a domain concept in its own type, and validate in DTO classes rather
  than inside functions.
- Mark data that doesn't change `readonly`, and literal tables `as const`.
- Numbers with meaning are named constants (limits, windows, lengths). Tests may pin literal values on
  purpose: flag only a test literal that silently duplicates a constant the test is about.

### Functions

- One purpose each, roughly under 20 statements, at one level of abstraction.
- Name starts with a verb. Boolean-returning: `isX` / `hasX` / `canX`. Boolean variables read the same way.
- Prefer early returns and `map` / `filter` / `reduce` over nested blocks. Arrow functions for one-liners,
  named functions otherwise.
- Default parameter values rather than `null` / `undefined` checks.
- No blank lines inside a function body.
- Complete words, not abbreviations, except standard ones (`API`, `URL`, `i`, `j`, `err`, `ctx`, and `req`,
  `res`, `next` in middleware and guards).

### Classes and modules

- Small, single-purpose classes: under 10 public methods and 10 properties.
- Composition over inheritance. Extending a framework class through its documented hooks (for example
  `ThrottlerGuard.handleRequest`) is fine.
- JSDoc on every exported class and on public methods.

### Exceptions

- Throw for what you don't expect. Catch only to recover from an expected case or to add context;
  everything else goes to Nest's global handler.

### Tests

- Arrange-Act-Assert (unit) / Given-When-Then (e2e).
- Expected values come from the spec or a known-good literal, never recomputed the way the code computes
  them.
