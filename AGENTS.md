# NextGen Grader

## Rules by area

Read `.claude/rules/project-context.md` first. Before changing code in an area, read its rules file:

- `apps/web`, `apps/exam`, `packages/ui`, `packages/lib`: `.claude/rules/frontend-nextjs.md`
- `apps/api`: `.claude/rules/backend-nestjs.md`
- `packages/prisma`: `.claude/rules/prisma-db.md`

Before reviewing a change, read `CODING_STANDARDS.md`.

## Commits

Leave work uncommitted for the user to review. Commit or push only when the user asks; running a skill or command whose
steps commit (such as `/implement-spec`) counts as asking.

Conventional Commits 1.0.0. Scopes: `api`, `web`, `prisma`, `ci`, `deps`, `docs`. Example:
`feat(api): change username via PATCH /auth/username`

## Pull requests

One pull request per spec, not per ticket. Every ticket of a spec is committed to the spec's branch, and one PR at the
end closes the spec and all its tickets. After a ticket, go to the next ticket; open the PR once every ticket is done.

## Workspace packages

Adding or wiring a `packages/*` workspace into an app: `docs/workspace-packages.md`.

## Agent skills

### Issue tracker

Issues live in GitHub Issues for anomaly342/NextGen-Grader, managed with the `gh` CLI. See
`docs/agents/issue-tracker.md`.

### Triage labels

Default five-role vocabulary (needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix). See
`docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` and `docs/adr/` at the repo root, shared by apps/api, apps/web and packages/prisma.
See `docs/agents/domain.md`.
