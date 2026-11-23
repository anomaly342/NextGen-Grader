'use client';

import { getAuthErrorCode, type ApiError } from '@repo/lib/api/api-error';
import { apiRequest } from '@repo/lib/api/browser-client';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

/**
 * Username change. `changeUsername(username, { onSuccess, onError })` sends
 * it to `PATCH /auth/username` and, on success, refreshes the server
 * components so the page and the header show the new username. After a
 * failure, `isError` is true and `error` is its auth code (null when it has
 * none, e.g. a 5xx).
 */
export function useChangeUsername() {
  const router = useRouter();
  const { mutate, isPending, isSuccess, isError, error } = useMutation<
    unknown,
    ApiError,
    string
  >({
    mutationFn: (username) =>
      apiRequest('/auth/username', { method: 'PATCH', body: { username } }),
    onSuccess: () => router.refresh(),
  });

  return {
    changeUsername: mutate,
    isPending,
    isSuccess,
    isError,
    error: getAuthErrorCode(error),
  };
}
