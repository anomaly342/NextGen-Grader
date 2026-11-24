# 0004. The proxy does not forward the signed-in User in a header

- Status: accepted
- Date: 2026-11-25
- Issue: #29 (spec #26)

## Context

The Classroom app's proxy (`apps/web/src/proxy.ts`) calls `GET /auth/me` on every page navigation to decide where a User
may go. Server components then need the same User to render (the user menu, `/account`, `/setup`). They get it from
`getCurrentUser()` in `apps/web/src/lib/current-user.ts`, which calls `GET /auth/me` again. React `cache()` makes the
layout and the page share one call per render (with `cacheComponents` a request can render in more than one pass; Next's
per-request memoization of identical `GET` fetches folds those into one call). Neither spans the proxy and the render,
so a page load makes two `GET /auth/me` calls.

The obvious way to save one call is to have the proxy put the User (or its Role) in a request header and let server
components trust that header.

## Decision

The proxy does not forward the signed-in User to server components. Server components load the User themselves through
`getCurrentUser()` / `requireCurrentUser()`. Two `GET /auth/me` calls per page load (proxy + render) are accepted on
purpose.

## Considered Options

- **Forward the User in a request header set by the proxy.** Rejected: the proxy's matcher skips some routes (the `/api`
  rewrite, Next's own files, paths with a file extension), and matchers change over time. On any route the proxy does
  not run on, a client could send that header itself and a server component would trust it, for example to claim the
  Teacher Role. Stripping the header on every route would have to be right forever, everywhere.
- **Cache the User in the proxy (in memory, keyed by Session).** Rejected: it would serve a stale User after logout,
  username change or Role change, and an in-process cache is not shared across instances (see
  [deployment](../ops/deployment.md)). Out of scope for spec #26 anyway.
- **One call per render, shared with `cache()`.** Chosen.

## Consequences

- A signed-in page load makes two `GET /auth/me` calls: one in the proxy, one in the render. `<Link>` prefetches run the
  proxy again and add proxy calls of their own. Nobody should "optimise" this to one through a header without revisiting
  this ADR.
- Next's fetch memoization already merged the layout's and the page's calls before `current-user.ts` existed, so the
  module removes duplicated code and redirects; it does not save a network call.
- The render-time redirect in `requireCurrentUser()` is only a fallback for a Session that ends between the proxy check
  and the render. It sends the User to plain `/login`; the proxy owns `next=`.
- The API still checks the Session on every call, so neither call decides access on its own.
