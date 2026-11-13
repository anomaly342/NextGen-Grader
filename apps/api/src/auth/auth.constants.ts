import type { CookieOptions } from 'express';

/** Cookie holding the OAuth `state` between /auth/google and its callback (CSRF check). */
export const OAUTH_STATE_COOKIE_NAME = 'oauth_state';

/** How long a login attempt may take, in milliseconds (10 minutes). */
export const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

/** Path both Google routes live under, so the state cookie is only sent there. */
export const GOOGLE_AUTH_PATH = '/auth/google';

/** Google scopes: an ID token with the user's email, name and picture. */
export const GOOGLE_SCOPES = ['openid', 'email', 'profile'];

/** Only university Google accounts may sign in. */
export const ALLOWED_EMAIL_DOMAIN = 'email.kmutnb.ac.th';

/** Options every auth cookie shares. HTTPS-only in production; plain HTTP on localhost. */
export const BASE_COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env['NODE_ENV'] === 'production',
};
