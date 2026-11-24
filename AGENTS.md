# NextGen Grader

## Commits

Conventional Commits 1.0.0. Scopes: `api`, `web`, `prisma`, `ci`, `deps`, `docs`.
Example: `feat(api): change username via PATCH /auth/username`

## Workspace packages

Adding or wiring a `packages/*` workspace into an app: `docs/workspace-packages.md`.

## Agent skills

### Issue tracker

Issues live in GitHub Issues for anomaly342/NextGen-Grader, managed with the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-role vocabulary (needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` and `docs/adr/` at the repo root, shared by apps/api, apps/web and packages/prisma. See `docs/agents/domain.md`.
