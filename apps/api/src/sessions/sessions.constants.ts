/** Name of the cookie that holds the session's cookie id. */
export const SESSION_COOKIE_NAME = 'sid';

/** How long a session lives, in seconds (7 days): Redis key, JWT and cookie. */
export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

/** The same lifetime in milliseconds, for cookie `maxAge`. */
export const SESSION_TTL_MS = SESSION_TTL_SECONDS * 1000;
