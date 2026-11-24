# Deployment

How the API is reached in production, and what that means for code that keys on the client IP or keeps state in process
memory.

> **Stub.** The open questions below are not answered yet. Until they are, treat anything keyed by client IP or held in
> memory as unverified in production.

## What the code assumes today

- **Client IP is `req.ip`, with Express's default `trust proxy` (off).** Nothing in `apps/api` calls
  `app.set('trust proxy', …)`. Behind a reverse proxy, `req.ip` is the proxy's address, so every user shares one IP.
- **The login rate limit is in memory per API process** (`@nestjs/throttler`'s default storage, see
  [ADR-0001](../adr/0001-login-rate-limit-via-nestjs-throttler.md)). With N API instances behind a load balancer, each
  instance counts separately, so the real limit is up to N times the configured one.
- **Sessions are in Redis** (`REDIS_URL`), so they are shared across instances.
- `docker-compose.yml` runs only Postgres and Redis, for local development. It has no proxy and no API container.

## Open questions

1. Does anything sit in front of the API (nginx, a campus load balancer, the Next.js server proxying `/api`)? If yes:
   how many hops, and does it set `X-Forwarded-For`?
   - If yes, the API needs `trust proxy` set to that hop count (or the proxy's address) so `req.ip` is the student's IP.
     Otherwise the 100-tries-per-minute IP limit applies to all users together.
2. How many API instances run at once?
   - More than one: decide whether the login rate limit should move to Redis storage.
3. Where does the API run (VM, container host), and who owns it?
