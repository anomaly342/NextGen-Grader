import type { GOOGLE_CALLBACK_ERROR_CODES } from '@/auth/auth.constants';

/** A Google sign-in failure shown on the web app's /login page as `?error=<code>`. */
export type GoogleCallbackErrorCode =
  (typeof GOOGLE_CALLBACK_ERROR_CODES)[number];
