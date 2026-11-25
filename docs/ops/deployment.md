# Deployment

How the API is reached in production, and what that means for code that keys on the client IP or keeps state in process
memory.

> **Stub.** The open questions below are not answered yet. Until they are, treat anything keyed by client IP or held in
> memory as unverified in production.

## What the code assumes today

- **Client IP is `req.ip`, with Express's default `trust proxy` (off).** Nothing in `apps/api` calls
  `app.set('trust proxy', …)`. Behind a reverse proxy, `req.ip` is the proxy's address, so every user shares one IP.
- **No in-process rate limiter is wired** (the earlier `@nestjs/throttler` setup in
  [ADR-0001](../adr/0001-login-rate-limit-via-nestjs-throttler.md) was removed). If rate limiting is added later, decide
  whether counters belong in Redis or at the reverse proxy.
- **Sessions are in Redis** (`REDIS_URL`), so they are shared across instances.
- `docker-compose.yml` runs only Postgres and Redis, for local development. It has no proxy and no API container.

## Open questions

1. Does anything sit in front of the API (nginx, a campus load balancer, the Next.js server proxying `/api`)? If yes:
   how many hops, and does it set `X-Forwarded-For`?
   - If yes, the API needs `trust proxy` set to that hop count (or the proxy's address) before anything relies on
     `req.ip` being the student's IP.
2. How many API instances run at once?
   - More than one: any future rate limiter or cache that needs cross-instance consistency must live in Redis or the
     proxy, not process memory.
3. Where does the API run (VM, container host), and who owns it?
