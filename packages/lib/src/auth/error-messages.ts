import { isAuthErrorCode, type AuthErrorCode } from './error-codes.ts';

/** User-facing text for each code. The `Record` makes TypeScript require every code. Switch on the code, never on the API's message text. */
const ERROR_MESSAGES: Readonly<Record<AuthErrorCode, string>> = {
  NOT_SIGNED_IN: 'You are signed out. Sign in again.',
  CREDENTIAL_SETUP_REQUIRED: 'Choose a username and password first.',
  INVALID_CREDENTIALS: 'Wrong username or password.',
  TOO_MANY_ATTEMPTS: 'Too many sign-in tries. Wait and try again.',
  USERNAME_TAKEN: 'That username is taken. Choose another.',
  SETUP_ALREADY_DONE: 'Your username and password are already set.',
  RECENT_GOOGLE_SIGN_IN_REQUIRED:
    'The 10 minutes to reset your password have passed. Sign in with your university account again.',
  LOGIN_EXPIRED: 'Your sign-in expired or was cancelled. Try again.',
  EMAIL_NOT_VERIFIED: 'Google has not verified this email address.',
  DOMAIN_NOT_ALLOWED:
    'Sign in with your university account (@email.kmutnb.ac.th or @kmutnb.ac.th).',
};

const FALLBACK_MESSAGE = 'Something went wrong. Try again.';

/** Text to show for an API error `code` (or `?error=`); a general message for anything unknown. */
export function getErrorMessage(code: string | null | undefined): string {
  return isAuthErrorCode(code) ? ERROR_MESSAGES[code] : FALLBACK_MESSAGE;
}
