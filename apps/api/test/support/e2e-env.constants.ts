/**
 * Where the e2e suite talks to. Defaults match docker-compose.yml, but use a
 * separate database and Redis db index so tests never wipe dev data.
 * Override with E2E_DATABASE_URL / E2E_REDIS_URL (e.g. in CI).
 */
export const E2E_DATABASE_URL =
  process.env['E2E_DATABASE_URL'] ??
  'postgresql://postgres:postgres@localhost:5434/nextgen_grader_e2e';

export const E2E_REDIS_URL =
  process.env['E2E_REDIS_URL'] ?? 'redis://:redis@localhost:6379/15';

/** Where the API redirects after Google sign-in. */
export const E2E_WEB_URL = 'http://web.test';
