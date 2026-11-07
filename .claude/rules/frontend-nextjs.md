---
paths:
  - "apps/web/**/*.{ts,tsx,css}"
---

# Frontend (apps/web)

## Routing (App Router)

Route groups match the spec:
- Public: `/login`, `/setup`, `/exam/login`
- Student: `/classrooms`, `/classrooms/[classroomId]/{assignments,practice,scores}`,
  `/classrooms/[classroomId]/problems/[problemId]`, `/classrooms/[classroomId]/submissions/[submissionId]`
- Teacher: `/teach`, `/teach/classrooms/...`, `/teach/exams/[examId]/...`, `/admin/users`
- Exam: `/exam`, `/exam/problems/[problemId]`, `/exam/results` (examinee cookie only)

Middleware redirects: no session → `/login`; credentials not set → `/setup`; examinee cookie on a non-exam
route → `/exam`. Hide the Practice tab when the classroom is `ALL_MANDATORY`.

## Data

- All server state goes through TanStack Query with one typed API client (`lib/api.ts`). No `fetch` in components.
- Query keys are arrays starting with the resource: `['classroom', id]`, `['submissions', { problemId }]`.
- Socket events update or invalidate queries in one place (`lib/realtime.ts`); components do not subscribe to sockets directly.
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
- Keep domain display logic (score text for each grading mode, level badges) in `lib/format/*` with unit tests.
