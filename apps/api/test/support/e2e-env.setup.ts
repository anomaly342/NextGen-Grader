import {
  E2E_DATABASE_URL,
  E2E_REDIS_URL,
  E2E_WEB_URL,
} from './e2e-env.constants';

/**
 * Jest `setupFiles`: runs before any test file imports the app, so modules that
 * read env vars at load time (db.ts, JwtModule.register) see the test values.
 * Overrides, never inherits, DATABASE_URL and REDIS_URL so tests can't hit dev data.
 */
process.env['DATABASE_URL'] = E2E_DATABASE_URL;
process.env['REDIS_URL'] = E2E_REDIS_URL;
process.env['WEB_URL'] = E2E_WEB_URL;
process.env['JWT_SECRET'] = 'e2e-jwt-secret';
process.env['GOOGLE_CLIENT_ID'] = 'e2e-google-client-id';
process.env['GOOGLE_CLIENT_SECRET'] = 'e2e-google-client-secret';
process.env['GOOGLE_CALLBACK_URL'] = 'http://web.test/api/auth/google/callback';
