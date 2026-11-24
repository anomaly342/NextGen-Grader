/** The sign-in page. */
export const LOGIN_PATH = '/login';
/** The Credential setup page. */
export const SETUP_PATH = '/setup';
/** The home page; the proxy sends it on to the User's landing page. */
export const HOME_PATH = '/';

/** Longest `next` path kept; longer ones are dropped. */
export const NEXT_PATH_MAX_LENGTH = 2048;

/**
 * A same-site relative path: exactly one leading `/` (so no scheme and no
 * `//host`), then no backslash or control character. Browsers read `\` as `/`
 * and drop tabs and newlines, which would turn `/\evil.com` into `//evil.com`.
 */
// eslint-disable-next-line no-control-regex -- control characters are exactly what it rejects
const SAME_SITE_PATH_PATTERN = /^\/(?![/\\])[^\\\u0000-\u001f\u007f]*$/;

/**
 * `next` if it is a same-site relative path, otherwise null. The API uses it
 * for `GET /auth/google?next=`, the web app for `/login?next=` and `/setup?next=`,
 * so a crafted link cannot send the User off-site after sign-in.
 */
export function getSameSitePath(next: unknown): string | null {
  if (typeof next !== 'string' || next.length > NEXT_PATH_MAX_LENGTH) {
    return null;
  }
  return SAME_SITE_PATH_PATTERN.test(next) ? next : null;
}

/**
 * `page?next=<next>`, or just `page` when `next` is not a same-site path. The
 * one builder of `next=` URLs, so no caller can skip the same-site check.
 */
export function withNext(page: string, next: string | null): string {
  const safeNext = getSameSitePath(next);
  return safeNext
    ? `${page}?${new URLSearchParams({ next: safeNext }).toString()}`
    : page;
}
