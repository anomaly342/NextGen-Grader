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
