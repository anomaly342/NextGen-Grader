# 0001. Login rate limit via @nestjs/throttler

- Status: accepted
- Date: 2026-11-20
- Issue: #12 (parent #5)

## Context

`POST /auth/login` has to rate-limit per username, not only per IP, so a lab that shares one IP address doesn't lock
itself out. The issue as first written asked for:

- 5 **failed** tries per minute per username, counted against the lowercased username so case variants share one counter
- 100 tries per minute per IP
- over either limit: 429 `TOO_MANY_ATTEMPTS` with `retryAfterSec`

The API already used `@nestjs/throttler` (in-memory storage, per IP) on this route.

## Decision

Extend `@nestjs/throttler` rather than write a Redis-backed limiter:

- `LoginThrottlerGuard` (`apps/api/src/common/guards/login-throttler.guard.ts`) subclasses `ThrottlerGuard`.
- Two named throttlers are registered in `AuthModule`: `ip` (100/min, tracked by `req.ip`) and `username` (5/min,
  tracked by the lowercased `username` from the body). A body with no string `username` skips the username counter and
  gets 400 from validation.
- The guard throws 429 `{ code: 'TOO_MANY_ATTEMPTS', message, retryAfterSec }` and sets `Retry-After`.

## Consequences

- **Every try counts, not only failed ones.** A successful login uses up one of the 5 per-username tries. After 5 tries
  in a minute, the 6th is refused even with the right password. In practice nobody signs in successfully 5 times a
  minute, so the only users this affects are those already being guessed at.
- **Counters are in memory per API process.** They are not shared across instances, and they reset when the process
  restarts. With N instances the effective limit is up to N times higher. See [deployment](../ops/deployment.md).
- **Client IP is `req.ip`.** Behind a proxy without `trust proxy`, every user shares the proxy's IP. See
  [deployment](../ops/deployment.md).
- The base guard also sends `X-RateLimit-*-{ip,username}` and `Retry-After-{ip,username}` headers.

## Revisit when

- the API runs more than one instance, or
- counting only failed tries becomes a requirement.

Either one points to Redis-backed storage: a custom `ThrottlerStorage` on the existing `Redis` client, or a small
limiter that refunds a try on successful login.
