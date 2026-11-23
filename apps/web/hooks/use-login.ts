'use client';

import { ApiError } from '@repo/lib/api/api-error';
import { apiRequest } from '@repo/lib/api/browser-client';
import {
  AUTH_ERROR_CODE,
  isAuthErrorCode,
  type AuthErrorCode,
} from '@repo/lib/auth/error-codes';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

/**
 * Username + password sign-in. `login(values, { onError })` posts them and,
 * on success, goes to `next` or `/`. `isBusy` stays true until the page has
 * left. After a failure, `isError` is true and `error` is its auth code (null
 * when the failure has none, e.g. a 5xx); `retryAfterSeconds` is set for
 * `TOO_MANY_ATTEMPTS`.
 */
export function useLogin(next: string | null) {
  const router = useRouter();
  const { mutateAsync, isPending, isSuccess, isError, error } = useMutation<
    unknown,
    ApiError,
    { username: string; password: string }
  >({
    mutationFn: (values: { username: string; password: string }) =>
      apiRequest('/auth/login', {
        method: 'POST',
        body: values,
      }),
    onSuccess: () => router.replace(next ?? '/'),
  });

  return {
    loginAsync: mutateAsync,
    isBusy: isPending || isSuccess,
    isError,
    error: getAuthErrorCode(error),
    retryAfterSeconds: getRetryAfterSeconds(error),
  };
}

/** The failure's auth error code, or null when it has none. */
function getAuthErrorCode(error: Error | null): AuthErrorCode | null {
  return error instanceof ApiError && isAuthErrorCode(error.code)
    ? error.code
    : null;
}

/** `retryAfterSec` from a 429 `TOO_MANY_ATTEMPTS` body, rounded up, or null. */
function getRetryAfterSeconds(error: Error | null): number | null {
  if (
    !(error instanceof ApiError) ||
    error.code !== AUTH_ERROR_CODE.TOO_MANY_ATTEMPTS
  ) {
    return null;
  }
  const retryAfterSec = error.body?.['retryAfterSec'];
  return typeof retryAfterSec === 'number' && retryAfterSec > 0
    ? Math.ceil(retryAfterSec)
    : null;
}
