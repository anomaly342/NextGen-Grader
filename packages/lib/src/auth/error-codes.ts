/**
 * Every `code` the auth API puts in an error body, plus the ones `/login?error=`
 * carries back from Google sign-in. The API throws with these and the web app
 * compares against them, so neither side spells a code as a string literal.
 */
export const AUTH_ERROR_CODE = {
  NOT_SIGNED_IN: 'NOT_SIGNED_IN',
  CREDENTIAL_SETUP_REQUIRED: 'CREDENTIAL_SETUP_REQUIRED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  TOO_MANY_ATTEMPTS: 'TOO_MANY_ATTEMPTS',
  USERNAME_TAKEN: 'USERNAME_TAKEN',
  SETUP_ALREADY_DONE: 'SETUP_ALREADY_DONE',
  RECENT_GOOGLE_SIGN_IN_REQUIRED: 'RECENT_GOOGLE_SIGN_IN_REQUIRED',
  LOGIN_EXPIRED: 'LOGIN_EXPIRED',
  EMAIL_NOT_VERIFIED: 'EMAIL_NOT_VERIFIED',
  DOMAIN_NOT_ALLOWED: 'DOMAIN_NOT_ALLOWED',
} as const;

/** One of the auth error codes. */
export type AuthErrorCode =
  (typeof AUTH_ERROR_CODE)[keyof typeof AUTH_ERROR_CODE];

const AUTH_ERROR_CODES: readonly string[] = Object.values(AUTH_ERROR_CODE);

/** Whether `code` (from an error body or `?error=`) is one of the auth error codes. */
export function isAuthErrorCode(code: unknown): code is AuthErrorCode {
  return typeof code === 'string' && AUTH_ERROR_CODES.includes(code);
}
