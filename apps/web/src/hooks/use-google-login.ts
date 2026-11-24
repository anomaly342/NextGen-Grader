'use client';

import { ApiError } from '@repo/lib/api/api-error';
import { apiRequest } from '@repo/lib/api/browser-client';
import { getErrorMessage } from '@repo/lib/auth/error-messages';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

/**
 * Google (University account) sign-in. `startGoogleLogin(next)` asks the API
 * for the Google URL and sends the browser there; `next` is the same-site path
 * to land on afterwards, or null for `/`. `isBusy` stays true until the page
 * has left.
 */
export function useGoogleLogin() {
  const { mutate, isPending, isSuccess } = useMutation({
    mutationFn: (next: string | null) =>
      apiRequest<{ url: string }>(
        `/auth/google${next ? `?${new URLSearchParams({ next }).toString()}` : ''}`,
      ),
    onSuccess: ({ url }) => window.location.assign(url),
    // Outside the form, so a toast (a live region already on the page) rather than a new banner.
    onError: (error) =>
      toast.error(
        getErrorMessage(error instanceof ApiError ? error.code : null),
      ),
  });
  return { startGoogleLogin: mutate, isBusy: isPending || isSuccess };
}
