---
paths:
  - 'apps/web/**/*.{ts,tsx,css}'
  - 'apps/exam/**/*.{ts,tsx,css}'
  - 'packages/ui/**/*.{ts,tsx,css}'
  - 'packages/lib/**/*.{ts,tsx}'
---

# Frontend

See [ADR 0002](../../docs/adr/0002-two-next-apps-shared-client.md).

## Apps

- `apps/web` is the Classroom site. Route groups do not appear in the URL.
  - Public: `/login`, `/setup`
  - Student: `/classrooms`, `/classrooms/[classroomId]/sections/<section number>/...`, `/problems/[problemId]`,
    `/submissions/[submissionId]`
  - Teacher: `/teach`, `/teach/classrooms/...`, `/admin/users`
- `apps/exam` is the exam site. One deployment serves each Classroom-year host (`data2026.grader.com`). Pages: `/login`,
  `/problems/[problemId]`. No Classroom or Teacher routes.
- Middleware on `apps/web` calls `GET /auth/me` via the server-only client: no session or 401 → `/login?next=<path>`;
  credential setup unfinished → `/setup`; a finished User on `/login` or `/setup` → `/`. It does not handle an Examinee.
  Hide the Practice tab when the Classroom is all-mandatory.
- The exam-room network does not route to the Classroom host. That filter is outside this repo.

## Data

- Shared UI is `packages/ui`. Components take props. They do not fetch. shadcn lives under `packages/ui`. Area
  components are grouped by area (`dashboard/dashboard-list.tsx`).
- `packages/lib` holds pure helpers, the API client, and the socket. Clients use relative URLs. They do not know the
  Nest host. Each app's `next.config` rewrites `/api` to Nest `/api/v1` and proxies the socket. No `app/api` proxy route
  handlers. The apps do not import each other.
- Middleware and server components use the app's server-only client (`apps/web/src/lib/server-client.ts`). It reads
  `API_INTERNAL_URL` and forwards the request's cookies. Server components fetch and pass props.
- In client components, server state goes through TanStack Query via the browser client. No `fetch` in components.
- Each query and mutation lives in its own hook, `apps/web/src/hooks/use-<action>.ts`, not inline in a component
  (enforced by ESLint). The hook returns named fields (`{ login, isBusy, error }`), never TanStack's whole result
  object. Use `mutate`; reach for `mutateAsync` only when the caller awaits the result. Pass TanStack's fields through
  under their own names (`isPending`, `isSuccess`, `isError`). A new name is only for a value the hook derives
  (`isBusy: isPending || isSuccess` while the page navigates away).
- Each piece of server data has one owner: a server component or a query, never both on one page. After a mutation,
  refresh the owner: `router.refresh()` for server-component data, `invalidateQueries` for query data.
- The browser client handles auth errors in one place: 401 `NOT_SIGNED_IN` → `/login?next=<current>`, 403
  `CREDENTIAL_SETUP_REQUIRED` → `/setup`.
- Username and password rules come from `packages/lib`, shared with the API. The API has the final say.
- Query keys are arrays starting with the resource: `['classroom', id]`, `['submissions', { problemId }]`.
- Socket events land in the Query cache: `setQueryData` when the event carries the full data, `invalidateQueries` when
  it only says something changed. One subscription hook per resource (`useSubmissionEvents(submissionId)`) lives in
  `packages/lib` beside the socket; on reconnect it invalidates its resource's queries to catch missed events.
  Components read from Query only.
- Switch on the backend's error `code`, not on message text. Keep a map from code to user-facing text. Compare against
  `AUTH_ERROR_CODE` from `@repo/lib/auth/error-codes`, the list the API throws with.
- Show times in Asia/Bangkok; send and receive ISO UTC.
- Never compute anything that decides access, deadlines or scores on the client; show what the API returns. Deadline
  countdowns are display only.

## State

- Put state in the URL when a link or the back button should restore it (tab, filters, page, chosen Section). URL state
  uses `nuqs`; add the package with the first page that needs it.
- Everything else is local `useState` / `useReducer`. No global store.

## Forms

Reference implementation: `apps/web/src/components/common/form/` and `apps/web/src/components/setup/setup-card.tsx`.
Read those files for field props and markup; use TanStack Form's own state for everything below rather than hand-rolled
validity or touched flags.

- Every form uses TanStack Form (`@tanstack/react-form`) through a form hook made with TanStack's `createFormHook` and
  the shared contexts in `src/contexts/form-context.ts`. Credential forms use `useCredentialForm` and
  `withCredentialFieldGroup` from `components/common/form/credential-form.ts`; another kind of form (create classroom)
  gets its own hook with its own field components, not more fields on the Credential one. Pass a `formId` (`'setup'`,
  `'change-password'`); every input id is `<formId>-<field name>`, so two forms on one page never share an id.
- Every Credential input goes through `CredentialField` (`components/common/form/credential-field.tsx`), which owns
  field-error visibility, `aria-invalid`/`aria-describedby`, submit-error clearing/focus, and optional
  `reserveMessageSpace` (prevents layout shift when live status/error messages toggle). Never copy error-display logic
  into individual forms. Reuse the field groups in `components/common/form/`:
  - `UsernameField` (`username-field.tsx`) for username input + live availability check (`useCheckUsername`);
  - `NewPasswordFields` (`new-password-fields.tsx`) for a new password and its confirmation.
- Validation is one form-level `validators.onChange` returning `{ fields: { <name>: text | undefined } }`, so every
  change checks every field (a field-level validator only runs when its own field changes, leaving untouched fields
  "valid"). For Credentials it calls `@repo/lib/auth/credential-rules` (`getUsernameError`, `getPasswordError`,
  `getConfirmPasswordError`), which return the finished message or `undefined`. Field-level async validation is used
  only for the live username check.
- Submit button: `<form.Subscribe selector={(s) => s.isValid && !s.isPristine}>` → `disabled={!canSubmit || isBusy}`.
  When a form includes `UsernameField`, also include `&& !s.isFieldsValidating` in the selector **and** disable while
  `isFetching` from `useCheckUsername()` is true (`@tanstack/form-core@1.33.5` `isFieldsValidating` can flip `false`
  early during debounced re-edits, so `isFetching` keeps submit disabled while a check is in flight).
- Read form state with `useSelector`, not the deprecated `useStore`.
- Submit through a TanStack Query mutation. On `ApiError`, a code tied to one field (`USERNAME_TAKEN`) is one call:
  `setSubmitError(form, 'username', getErrorMessage(error.code))`. Anything else shows above the form via
  `getErrorMessage(code)`.

## Loading and errors

- Each route segment has `loading.tsx` and `error.tsx`. They render `PageLoading` and `PageError` from
  `apps/web/src/components/common/` (`PageError` takes the route's title and Next's `retry`).
- Form errors show inline in the form. Mutation errors outside a form show as a toast (shadcn `sonner`).

## Uploads

- Submission upload accepts only `.cpp`, max 64 KB, checked before sending. There is no in-browser code editor.
- Show live status from the socket: Queued → Compiling → Evaluating → result.

## UI style

- White theme. Background `#f6f7f9`, surfaces `#ffffff`, ink `#161d2b`, muted `#5a6477`, brand `#2449b8`. Good
  `#16794a`, warning `#9a5b00`, bad `#b3332c`. Optional-problem accent `#d0612a`.
- Font: Manrope for UI, JetBrains Mono for code and join codes.
- Use shadcn/ui components. Hierarchy comes from type weight and color, not from boxes inside boxes. Cards: 12px radius,
  soft shadow, no thick borders, no gradient backgrounds, no emoji, no left-border accent cards.
- Touch targets at least 44px. Every page works at 390px wide; wide tables scroll inside their own container.
- Use real `<button>`, `<a>`, `<label>` + `<input>`; icon-only buttons need `aria-label`. Text contrast 4.5:1.
- Copy is short and plain. Verdict names shown to users: Accepted, Partial, Wrong answer, Time limit, Memory limit,
  Runtime error, System error.

## Components

- App code lives under `src/`: `src/app`, `src/components`, `src/contexts`, `src/hooks`, `src/lib`, `src/providers`, and
  `src/proxy.ts`. Config files (`next.config.ts`, `tsconfig.json`, `eslint.config.mjs`) and `public/` stay at the app
  root. `@/` points at `src/`.
- Components used by more than one area live in `src/components/common/` (a module of several files gets its own folder,
  `common/form/`). React contexts live in `src/contexts/`. Name a module after what it covers (`credential-form`), not
  after the app (`app-form`).
- Pages are server components that render client components for interactive parts. Put `'use client'` on the smallest
  interactive piece.
- Named exports. Kebab-case file and directory names (`auth-wizard/login-form.tsx`).
- String-literal unions instead of TS `enum` (`type SkillLevel = 'WEAK' | 'DEVELOPING' | ...`).
- Tailwind is mobile-first: base classes for 390px, `md:` / `lg:` for wider.
- Keep domain display logic (score text for each grading mode, level badges) in `packages/lib` with unit tests.
