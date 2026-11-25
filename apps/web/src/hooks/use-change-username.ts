'use client';

import { getAuthErrorCode, type ApiError } from '@repo/lib/api/api-error';
import { apiRequest } from '@repo/lib/api/browser-client';
import { AUTH_ERROR_CODE } from '@repo/lib/auth/error-codes';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
  USERNAME_AVAILABILITY_QUERY_KEY,
  getUsernameAvailabilityKey,
} from './use-check-username';

/**
 * Username change. `changeUsername(username, { onSuccess, onError })` sends
 * it to `PATCH /auth/username` and, on success, clears cached availability
 * checks and refreshes the server components so the page and the header show
 * the new username. After a failure, `isError` is true and `error` is its auth
 * code (null when it has none, e.g. a 5xx).
 */
export function useChangeUsername() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { mutate, isPending, isSuccess, isError, error } = useMutation<
    unknown,
    ApiError,
    string
  >({
    mutationFn: (username) =>
      apiRequest('/auth/username', { method: 'PATCH', body: { username } }),
    onSuccess: () => {
      queryClient.removeQueries({
        queryKey: USERNAME_AVAILABILITY_QUERY_KEY,
      });
      router.refresh();
    },
    onError: (mutationError, username) => {
      if (mutationError.code !== AUTH_ERROR_CODE.USERNAME_TAKEN) return;
      queryClient.removeQueries({
        queryKey: getUsernameAvailabilityKey(username),
      });
    },
  });

  return {
    changeUsername: mutate,
    isPending,
    isSuccess,
    isError,
    error: getAuthErrorCode(error),
  };
}
