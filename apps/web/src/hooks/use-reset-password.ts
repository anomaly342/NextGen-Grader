'use client';

import { getAuthErrorCode, type ApiError } from '@repo/lib/api/api-error';
import { apiRequest } from '@repo/lib/api/browser-client';
import { useMutation } from '@tanstack/react-query';

/**
 * Password reset. `resetPassword(newPassword)` posts it to
 * `POST /auth/password/reset`, which only works within 10 minutes of a Google
 * sign-in; this session stays signed in. After a failure, `isError` is true
 * and `error` is its auth code (`RECENT_GOOGLE_SIGN_IN_REQUIRED` once the
 * window has passed; null when it has none).
 */
export function useResetPassword() {
  const { mutate, isPending, isSuccess, isError, error } = useMutation<
    void,
    ApiError,
    string
  >({
    mutationFn: (newPassword) =>
      apiRequest<void>('/auth/password/reset', {
        method: 'POST',
        body: { newPassword },
      }),
  });

  return {
    resetPassword: mutate,
    isPending,
    isSuccess,
    isError,
    error: getAuthErrorCode(error),
  };
}
