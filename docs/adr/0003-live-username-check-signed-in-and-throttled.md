# 0003. Live username check: signed-in only

- Status: accepted
- Date: 2026-11-24
- Issue: #22

## Context

Password login hides which usernames exist: a wrong username and a wrong password both get 401 `INVALID_CREDENTIALS`.
Credential setup and username change want to tell the User a username is taken while they type, not only after submit.
That means an endpoint answering "does this username exist?", which is exactly what login hides, and usernames are
sign-in handles.

## Decision

Add `GET /auth/check-username`, returning empty `200` when free and `409 USERNAME_TAKEN` when taken, and accept that it
reveals which usernames exist under these constraints:

- It needs a Session, so only a User who signed in with their University account can ask. It works before Credential
  setup is done (`@SkipCredentialSetup()`).
- It is a hint only. Submit still gets `409 USERNAME_TAKEN` from the unique constraint when two Users race.
- No in-process rate limiter is wired (`@nestjs/throttler` was removed; see
  [ADR-0001](./0001-login-rate-limit-via-nestjs-throttler.md)). If rate limiting is added later, key it per User, never
  per IP (the lab shares one IP; see [deployment](../ops/deployment.md)).

## Considered Options

- **No live check, 409 on submit only.** Leaks the same fact, one submit at a time. Rejected: the User finds out late
  and has to retype.
- **Public endpoint.** Rejected: unauthenticated callers should not be able to enumerate usernames.
- **Per-User in-memory throttling via `@nestjs/throttler`.** Removed alongside ADR-0001 to avoid carrying an in-process
  throttler.

## Consequences

- Any signed-in User can check whether a username is taken. Unauthenticated callers get `401 NOT_SIGNED_IN`.
- Because `200` means free and `409` means taken, TanStack Query caches only free `200` responses; `409` throws
  `ApiError` and is never cached as a valid result.
