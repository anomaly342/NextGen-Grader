/** Name of the cookie that holds the User session's cookie id. */
export const SESSION_COOKIE_NAME = 'ngg.sid';

/**
 * Cookie name reserved for Examinee sessions.
 * Nothing reads or sets it until exam mode.
 */
export const EXAMINEE_SESSION_COOKIE_NAME = 'ngg.exam.sid';

/** How long a session lives, in seconds (7 days): Redis key, JWT and cookie. */
export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

/** Prefix of the Redis key that holds a session record. The rest is the cookie id. */
export const SESSION_KEY_PREFIX = 'ngg:session:';

/** The same lifetime in milliseconds, for cookie `maxAge`. */
export const SESSION_TTL_MS = SESSION_TTL_SECONDS * 1000;
