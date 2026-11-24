'use client';

import { getAuthErrorCode, type ApiError } from '@repo/lib/api/api-error';
import { apiRequest } from '@repo/lib/api/browser-client';
import { AUTH_ERROR_CODE } from '@repo/lib/auth/error-codes';
import { HOME_PATH } from '@repo/lib/auth/next-path';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

/**
 * Username + password sign-in. `login(values, { onError })` posts them and,
 * on success, goes to `next` or `/`. `isBusy` stays true until the page has
 * left. After a failure, `isError` is true and `error` is its auth code (null
 * when the failure has none, e.g. a 5xx); `retryAfterSeconds` is the
 * `TOO_MANY_ATTEMPTS` wait, rounded up, or null.
 */
export function useLogin(next: string | null) {
  const router = useRouter();
  const { mutate, isPending, isSuccess, isError, error } = useMutation<
    unknown,
    ApiError,
    { username: string; password: string }
  >({
    mutationFn: (values: { username: string; password: string }) =>
      apiRequest('/auth/login', {
        method: 'POST',
        body: values,
      }),
    onSuccess: () => router.replace(next ?? HOME_PATH),
  });

  const hasRetryWait =
    error?.code === AUTH_ERROR_CODE.TOO_MANY_ATTEMPTS &&
    error.retryAfterSec !== null;
  const retryAfterSeconds = hasRetryWait
    ? Math.ceil(error.retryAfterSec)
    : null;

  return {
    login: mutate,
    isBusy: isPending || isSuccess,
    isError,
    error: getAuthErrorCode(error),
    retryAfterSeconds,
  };
}
