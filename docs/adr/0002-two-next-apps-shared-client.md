# 0002. Two Next apps, shared client

- Status: accepted
- Date: 2026-11-21

## Context

The Classroom site and the exam site are different hosts. Exams are taken on a lab network. An Examinee must not reach Classroom pages by editing the path. A single app with an exam route group would still contain those pages, and a reverse proxy in front of that app was not a strong enough guarantee.

## Decision

- `apps/web` is the Classroom site. `apps/exam` is the exam site. One `apps/exam` deployment serves every Classroom-year host, such as `data2026.grader.com`. The host selects the Classroom. The signed-in Examinee selects the Exam.
- Problem pages are `/problems/[problemId]` on both hosts. Section pages are `/classrooms/[classroomId]/sections/<section number>`. Section numbers start at 1 and do not change when another Section is removed.
- Shared components live in `packages/ui` and take props. They do not fetch. `packages/lib` holds pure helpers plus the API client and the socket. Those clients use relative URLs and do not know the Nest host. Each app's `next.config` rewrites `/api` to the Nest `/api/v1` prefix, and proxies the socket. There are no hand-written proxy route handlers.
- `packages/lib` also has a server-only client for the proxy (middleware) and server components. It is the only code that knows the Nest host, read from `API_INTERNAL_URL`, and it forwards the incoming request's cookies. Server components fetch with it and pass data down as props. TanStack Query is for client components only.
- The browser talks to Nest only through the `/api` rewrite, including the Google sign-in callback. So `ngg.sid` is a first-party cookie on the app's own host.
- The apps do not import each other. Classroom middleware calls `GET /auth/me` through the server-only client. It sends a missing or expired session to `/login` and unfinished credential setup to `/setup`. It does not handle an Examinee.
- The exam-room network does not route to the Classroom host. That filter is outside this repo. `apps/exam` also has no Classroom routes. The API still refuses a Problem the User or Examinee is not allowed to open.

## Consequences

- Two deploys, two rewrites, one Nest API.
- A lab machine that can still open the Classroom host bypasses the exam-room network rule. This repo does not close that hole.
- Rating-step amounts are not chosen. The weight sum is the only scoring method for now.
