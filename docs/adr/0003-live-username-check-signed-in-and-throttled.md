# 0003. Live username check: signed-in only, throttled per User

- Status: accepted
- Date: 2026-11-24
- Issue: #22

## Context

Password login hides which usernames exist: a wrong username and a wrong password both get 401
`INVALID_CREDENTIALS`. Credential setup and username change want to tell the User a username is taken while
they type, not only after submit. That means an endpoint answering "does this username exist?", which is
exactly what login hides, and usernames are sign-in handles.

## Decision

Add `GET /auth/check-username`, answering whether a username is free, and accept that it reveals which
usernames exist, under these limits:

- It needs a Session, so only a User who signed in with their University account can ask. It works before
  Credential setup is done.
- It is throttled per User, never per IP (the lab shares one IP; see [deployment](../ops/deployment.md)), with
  the in-memory throttler from [ADR-0001](./0001-login-rate-limit-via-nestjs-throttler.md).
- It is a hint only. Submit still gets 409 `USERNAME_TAKEN` from the unique constraint when two Users race.

## Considered Options

- **No live check, 409 on submit only.** Leaks the same fact, one submit at a time. Rejected: the User finds
  out late and has to retype.
- **Public endpoint, throttled per IP.** Rejected: anyone could list usernames, and the shared lab IP would
  make the limit hit everyone at once.

## Consequences

- A signed-in User can learn whether a username exists, slowly. The login limit of 5 tries per username per
  minute still applies to any username they learn.
- Like ADR-0001, the counter is per API process; with N instances the real limit is up to N times higher.
