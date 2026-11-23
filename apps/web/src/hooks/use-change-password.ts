'use client';

import { getAuthErrorCode, type ApiError } from '@repo/lib/api/api-error';
import { apiRequest } from '@repo/lib/api/browser-client';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

/**
 * Password change. `changePassword(values, { onSuccess, onError })` posts the
 * current and new password to `POST /auth/password`; this session stays
 * signed in. On success it refreshes the server components. A wrong current
 * password is `INVALID_CREDENTIALS` and changes nothing. After a failure,
 * `isError` is true and `error` is its auth code (null when it has none).
 */
export function useChangePassword() {
  const router = useRouter();
  const { mutate, isPending, isSuccess, isError, error } = useMutation<
    void,
    ApiError,
    { currentPassword: string; newPassword: string }
  >({
    mutationFn: (values) =>
      apiRequest<void>('/auth/password', { method: 'POST', body: values }),
    onSuccess: () => router.refresh(),
  });

  return {
    changePassword: mutate,
    isPending,
    isSuccess,
    isError,
    error: getAuthErrorCode(error),
  };
}
