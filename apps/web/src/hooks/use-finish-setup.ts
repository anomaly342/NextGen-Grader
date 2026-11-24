'use client';

import { getAuthErrorCode, type ApiError } from '@repo/lib/api/api-error';
import { apiRequest } from '@repo/lib/api/browser-client';
import { AUTH_ERROR_CODE } from '@repo/lib/auth/error-codes';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { getUsernameAvailabilityKey } from './use-check-username';

/**
 * Credential setup. `finishSetup(values, { onError })` posts the username and
 * password to `POST /auth/setup` and, on success, goes to `next` or `/` (the
 * API has already swapped in the new session cookie). `isBusy` stays true
 * until the page has left. After a failure, `isError` is true and `error` is
 * its auth code (null when it has none, e.g. a 5xx).
 */
export function useFinishSetup(next: string | null) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { mutate, isPending, isSuccess, isError, error } = useMutation<
    unknown,
    ApiError,
    { username: string; password: string }
  >({
    mutationFn: (values) =>
      apiRequest('/auth/setup', { method: 'POST', body: values }),
    onSuccess: () => router.replace(next ?? '/'),
    onError: (mutationError, values) => {
      if (mutationError.code !== AUTH_ERROR_CODE.USERNAME_TAKEN) return;
      queryClient.removeQueries({
        queryKey: getUsernameAvailabilityKey(values.username),
      });
    },
  });

  return {
    finishSetup: mutate,
    isBusy: isPending || isSuccess,
    isError,
    error: getAuthErrorCode(error),
  };
}
