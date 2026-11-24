'use client';

import { apiRequest } from '@repo/lib/api/browser-client';
import { useIsFetching, useQueryClient } from '@tanstack/react-query';

/** Query-key prefix for live username availability checks. */
export const USERNAME_AVAILABILITY_QUERY_KEY = [
  'username-availability',
] as const;

/** Query key for one username's availability check. */
export function getUsernameAvailabilityKey(
  username: string,
): readonly ['username-availability', string] {
  return [...USERNAME_AVAILABILITY_QUERY_KEY, username] as const;
}

/** How long a free username availability check stays cached per username. */
const USERNAME_CHECK_CACHE_MS = 30_000;

/**
 * Live username availability check (`GET /auth/check-username`), cached 30 s
 * per username in TanStack Query.
 *
 * - `checkUsername(username, signal)` resolves on 200 (free, cached 30 s) and
 *   throws `ApiError` on 409 `USERNAME_TAKEN` or other failures.
 * - `isFetching` is true while any username availability check is in flight.
 */
export function useCheckUsername() {
  const queryClient = useQueryClient();
  const isFetching =
    useIsFetching({ queryKey: USERNAME_AVAILABILITY_QUERY_KEY }) > 0;

  const checkUsername = (
    username: string,
    signal?: AbortSignal,
  ): Promise<boolean> =>
    queryClient.query({
      queryKey: getUsernameAvailabilityKey(username),
      queryFn: async () => {
        await apiRequest<void>(
          `/auth/check-username?${new URLSearchParams({ username }).toString()}`,
          { signal },
        );
        return true;
      },
      staleTime: USERNAME_CHECK_CACHE_MS,
      retry: false,
    });

  return { checkUsername, isFetching };
}
