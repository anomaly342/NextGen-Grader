---
paths:
  - "apps/web/**/*.{ts,tsx,css}"
  - "apps/exam/**/*.{ts,tsx,css}"
  - "packages/ui/**/*.{ts,tsx,css}"
  - "packages/lib/**/*.{ts,tsx}"
---

# Frontend

See [ADR 0002](../../docs/adr/0002-two-next-apps-shared-client.md).

## Apps

- `apps/web` is the Classroom site. Route groups do not appear in the URL.
  - Public: `/login`, `/setup`
  - Student: `/classrooms`, `/classrooms/[classroomId]/sections/<section number>/...`,
    `/problems/[problemId]`, `/submissions/[submissionId]`
  - Teacher: `/teach`, `/teach/classrooms/...`, `/admin/users`
- `apps/exam` is the exam site. One deployment serves each Classroom-year host (`data2026.grader.com`).
  Pages: `/login`, `/problems/[problemId]`. No Classroom or Teacher routes.
- Middleware on `apps/web` calls `GET /auth/me` via the server-only client: no session or 401 → `/login?next=<path>`;
  credential setup unfinished → `/setup`; a finished User on `/login` or `/setup` → `/`.
  It does not handle an Examinee. Hide the Practice tab when the Classroom is all-mandatory.
- The exam-room network does not route to the Classroom host. That filter is outside this repo.

## Data

- Shared UI is `packages/ui`. Components take props. They do not fetch. shadcn lives under `packages/ui`.
  Area components are grouped by area (`dashboard/dashboard-list.tsx`).
- `packages/lib` holds pure helpers, the API client, and the socket. Clients use relative URLs.
  They do not know the Nest host. Each app's `next.config` rewrites `/api` to Nest `/api/v1` and proxies the socket.
  No `app/api` proxy route handlers. The apps do not import each other.
- Middleware and server components use the server-only client in `packages/lib`. It reads `API_INTERNAL_URL` and forwards
  the request's cookies. Server components fetch and pass props; after a mutation, call `router.refresh()`.
- In client components, server state goes through TanStack Query via the browser client. No `fetch` in components.
- The browser client handles auth errors in one place: 401 `NOT_SIGNED_IN` → `/login?next=<current>`,
  403 `CREDENTIAL_SETUP_REQUIRED` → `/setup`.
- Username and password rules come from `packages/lib`, shared with the API. The API has the final say.
- Query keys are arrays starting with the resource: `['classroom', id]`, `['submissions', { problemId }]`.
- Socket events update or invalidate queries in the shared client. Components do not subscribe to sockets directly.
- Switch on the backend's error `code`, not on message text. Keep a map from code to user-facing text.
- Show times in Asia/Bangkok; send and receive ISO UTC.
- Never compute anything that decides access, deadlines or scores on the client; show what the API returns.
  Deadline countdowns are display only.

## Uploads

- Submission upload accepts only `.cpp`, max 64 KB, checked before sending. There is no in-browser code editor.
- Show live status from the socket: Queued → Compiling → Evaluating → result.

## UI style

- White theme. Background `#f6f7f9`, surfaces `#ffffff`, ink `#161d2b`, muted `#5a6477`, brand `#2449b8`.
  Good `#16794a`, warning `#9a5b00`, bad `#b3332c`. Optional-problem accent `#d0612a`.
- Font: Manrope for UI, JetBrains Mono for code and join codes.
- Use shadcn/ui components. Hierarchy comes from type weight and color, not from boxes inside boxes.
  Cards: 12px radius, soft shadow, no thick borders, no gradient backgrounds, no emoji, no left-border accent cards.
- Touch targets at least 44px. Every page works at 390px wide; wide tables scroll inside their own container.
- Use real `<button>`, `<a>`, `<label>` + `<input>`; icon-only buttons need `aria-label`. Text contrast 4.5:1.
- Copy is short and plain. Verdict names shown to users: Accepted, Partial, Wrong answer, Time limit,
  Memory limit, Runtime error, System error.

## Components

- Pages are server components that render client components for interactive parts.
- Keep domain display logic (score text for each grading mode, level badges) in `packages/lib` with unit tests.
