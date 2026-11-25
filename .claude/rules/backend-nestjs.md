---
paths:
  - 'apps/api/**/*.ts'
---

# API (apps/api, NestJS)

Where code goes and what it's called. `bun run lint` runs `scripts/check-file-names.mjs`, which enforces the rules
marked _(checked)_. Style rules applied at review time live in `CODING_STANDARDS.md`.

## Files and folders

- One module per domain, folder and files named after it: plural when countable (`sessions/`, `SessionsModule`),
  singular when uncountable or infrastructure (`auth`, `redis`, `prisma`). Types for one item stay singular
  (`SessionUser`).
- File names are `<kebab-name>.<kind>.ts` _(checked)_. Kinds: `module`, `controller`, `service`, `guard`, `interceptor`,
  `decorator`, `filter`, `pipe`, `middleware`, `dto`, `interface`, `constants`, `util`, `setup`, plus `.spec.ts` next to
  the file it tests and `.e2e-spec.ts` in `test/`.
- Every type named `…Dto` goes in `dto/` as `.dto.ts` _(checked)_: request bodies are class-validator classes
  (`LoginDto`), responses and their row shapes too. A shape that both apps use (`User`) lives in `@repo/prisma` instead.
- Every other data type, `type` aliases included, goes in `interfaces/` as `.interface.ts` _(checked)_.
- One export per file; only `.constants.ts` may export several _(checked)_.
- `src/common/` holds shared code, one folder per kind: `guards/`, `decorators/`, `middleware/`, `swagger/`, `utils/`.
  **Every** guard, decorator and middleware lives there, even one only a single module uses today; such a guard may
  import that module's constants.
- Helpers used by one class are `private` methods of it _(checked for services)_. Helpers shared across modules go in
  `src/common/utils/`.
- `test/support/` (e2e doubles and helpers) mirrors `src/`'s layout, with shared types in `test/support/interfaces/`.

## Imports and injection

- Across modules import with `@/` (`@/sessions/sessions.service`), never `../` _(checked in `src/`)_. `./` is for the
  same folder. Inside `test/`, `../` between test files is fine; reach `src/` through `@/`.
- Name an injected dependency after its type in camelCase, never shortened: `prismaService: PrismaService`,
  `redisService: Redis`, `jwtService: JwtService` _(checked for those three)_.
- Persist through `PrismaService` (models come from the `@repo/prisma` contract); no entity classes.

## Tests

- Which tests to write is agreed per task at seams (the `tdd` skill), not one per function or class.
- Name test variables `inputX`, `mockX`, `actualX`, `expectedX`. E2E tests use Given-When-Then comments.
