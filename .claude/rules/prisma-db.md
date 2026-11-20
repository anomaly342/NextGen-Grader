---
paths:
  - "packages/prisma/**"
---

# Database (packages/prisma, Prisma 8)

- There is one contract, `src/prisma/contract.prisma`, shared by web and api. To change the schema, run these
  in `packages/prisma`:
  1. Edit `contract.prisma`.
  2. `bun run emit` regenerates `contract.json` / `contract.d.ts`. Both are gitignored; CI emits them itself.
  3. `bun run plan --name <short_change_name>` writes a migration under `migrations/app/`. Commit it.
     If the plan would lose data it refuses; answer with `--rename old:new` or `--delete <Model>`.
  4. `bun run migrate` applies it to `DATABASE_URL` and advances the `db` ref (`migrations/app/refs/db.json`).
     To migrate another database without moving the ref (e.g. the e2e one):
     `bunx prisma db migrate --db <url> --yes`.
- Every model has `updatedAt temporal.UpdatedAt` and `createdAt DateTime @default(now())`.
- Do not add fields that can be derived from other fields on the same row (e.g. a stored skill level that
  follows from `rating` and `ratedCount`). Compute them in code instead. Ask before adding denormalized data.
- Add a short `//` comment on any field whose meaning is not obvious from its name, including units
  (`timeLimit // seconds`, `memoryLimitMb`).
- Pick `onDelete` on purpose: `Cascade` for owned children (sections, testcases, results), `SetNull` for
  "who did it" links (`assignedById`, `createdById`). Never cascade-delete submissions from a user deletion
  without asking.
- Index foreign keys that are filtered on (`@@index([classroomId])`, `@@index([examId, problemId])`).
- Keep enum values UPPER_SNAKE. Enum names (Role exists; use these names for the rest): Role, GradingMode, ProblemKind, Difficulty, Language,
  RecommendationReason, ChatRole, Verdict, CheckStatus, SubmissionStatus.
- `fsobjects` is the CMS-compatible file table (`digest` = SHA-1 hex, `loid` = Postgres large object). Do not rename it.
- Change shared databases only through migrations.
