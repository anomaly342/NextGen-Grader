'use client';

import { AUTH_ERROR_CODE } from '@repo/lib/auth/error-codes';
import { ApiError } from '@repo/lib/api/api-error';
import { apiRequest } from '@repo/lib/api/browser-client';
import { LOGIN_PATH } from '@repo/lib/auth/next-path';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

/**
 * Log out. `logout()` ends the session, drops cached data and goes to
 * `/login`; `isBusy` stays true until the page has left.
 */
export function useLogout() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { mutate, isPending, isSuccess } = useMutation({
    mutationFn: () => apiRequest<void>('/auth/logout', { method: 'POST' }),
    onSuccess: () => {
      queryClient.clear();
      router.replace(LOGIN_PATH);
    },
    onError: (error) => {
      // An expired session is already logged out: the QueryClient's auth-error handler sends it to /login.
      if (
        error instanceof ApiError &&
        error.code === AUTH_ERROR_CODE.NOT_SIGNED_IN
      )
        return;
      toast.error('Could not log out. Try again.');
    },
  });
  return { logout: () => mutate(), isBusy: isPending || isSuccess };
}
