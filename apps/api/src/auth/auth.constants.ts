import type { CookieOptions } from 'express';

/** Cookie holding the OAuth `state` between /auth/google and its callback (CSRF check). */
export const OAUTH_STATE_COOKIE_NAME = 'oauth_state';

/** How long a login attempt may take, in milliseconds (10 minutes). */
export const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

/**
 * Browser-visible path both Google routes live under, so the state cookie is
 * only sent there. The browser sees the web host's `/api` rewrite, not Nest's
 * internal `/api/v1` prefix, so the cookie path uses `/api`.
 */
export const GOOGLE_AUTH_COOKIE_PATH = '/api/auth/google';

/**
 * Google sign-in failures the callback sends back to `/login?error=<code>`
 * instead of answering with JSON: the browser is mid-redirect, not a fetch.
 * LOGIN_EXPIRED covers a missing, mismatched or expired state or code.
 */
export const GOOGLE_CALLBACK_ERROR_CODES = [
  'LOGIN_EXPIRED',
  'EMAIL_NOT_VERIFIED',
  'DOMAIN_NOT_ALLOWED',
] as const;

/** Longest `next` path kept by GET /auth/google; longer ones are dropped. */
export const NEXT_PATH_MAX_LENGTH = 2048;

/**
 * A same-site relative path: exactly one leading `/` (so no scheme and no
 * `//host`), then no backslash or control character. Browsers read `\` as `/`
 * and drop tabs and newlines, which would turn `/\evil.com` into `//evil.com`.
 */
// eslint-disable-next-line no-control-regex -- control characters are exactly what it rejects
export const SAME_SITE_PATH_PATTERN = /^\/(?![/\\])[^\\\u0000-\u001f\u007f]*$/;

/** Google scopes: an ID token with the user's email, name and picture. */
export const GOOGLE_SCOPES = ['openid', 'email', 'profile'];

/**
 * University Google accounts that may sign in: students, then staff.
 * Match the part after `@` exactly (any letter case). A suffix check would
 * also allow `notemail.kmutnb.ac.th`.
 */
export const ALLOWED_EMAIL_DOMAINS = [
  'email.kmutnb.ac.th',
  'kmutnb.ac.th',
] as const;

/**
 * Google's consent screen accepts one `hd` hint. Students' domain only;
 * both domains are enforced in AuthService, not by this hint.
 */
export const GOOGLE_HD_HINT = ALLOWED_EMAIL_DOMAINS[0];

/** Options every auth cookie shares. HTTPS-only in production; plain HTTP on localhost. */
export const BASE_COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env['NODE_ENV'] === 'production',
};

/** Username rules for POST /auth/setup: 4–20 chars, lowercase letters, digits, underscore. */
export const USERNAME_MIN_LENGTH = 4;
export const USERNAME_MAX_LENGTH = 20;
export const USERNAME_PATTERN = /^[a-z0-9_]+$/;

/** Password length. bcrypt ignores everything past 72 bytes, so longer is refused. */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 72;

/** How long after a Google sign-in a forgotten-password reset is allowed. */
export const PASSWORD_RESET_WINDOW_MS = 10 * 60 * 1000;

/**
 * POST /auth/login rate limits, each per one-minute window. Per username (any
 * capitals share one counter) so one student's lockout doesn't block a lab that
 * shares one IP address; per IP as a looser cap on guessing across usernames.
 */
export const LOGIN_RATE_TTL_MS = 60 * 1000;
export const LOGIN_USERNAME_RATE_LIMIT = 5;
export const LOGIN_IP_RATE_LIMIT = 100;

/** Names of the two login throttlers registered with ThrottlerModule. */
export const LOGIN_IP_THROTTLER = 'ip';
export const LOGIN_USERNAME_THROTTLER = 'username';

/**
 * bcrypt hash of a random throwaway password. Login verifies against it when the
 * username doesn't exist, so unknown and known usernames take the same time.
 */
export const DUMMY_PASSWORD_HASH =
  '$2b$12$Y0Cyom8xEvoEqwpOrPqaAODanvtJD0tpqyy.WSqSrJcLXKo8aXFwi';

/** Postgres error for a unique-constraint violation, and the constraint on User.username. */
export const PG_UNIQUE_VIOLATION = '23505';
export const USERNAME_UNIQUE_CONSTRAINT = 'User_username_key';
