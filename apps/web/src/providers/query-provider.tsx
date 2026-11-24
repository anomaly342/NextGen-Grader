'use client';

import { ApiError } from '@repo/lib/api/api-error';
import { redirectOnAuthError } from '@repo/lib/api/auth-error-redirect';
import {
  MutationCache,
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

/** TanStack Query for client components, with auth errors handled in one place. */
export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => createQueryClient());
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

/** A QueryClient whose every query and mutation error goes through the one auth-error handler. */
function createQueryClient(): QueryClient {
  const queryClient: QueryClient = new QueryClient({
    queryCache: new QueryCache({
      onError: (error) => redirectOnAuthError(error, queryClient),
    }),
    mutationCache: new MutationCache({
      onError: (error) => redirectOnAuthError(error, queryClient),
    }),
    defaultOptions: { queries: { retry: canRetryQuery } },
  });
  return queryClient;
}

/** Retries network and 5xx failures up to MAX_QUERY_RETRIES times; a 4xx answer won't change on retry. */
function canRetryQuery(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.status < 500) return false;
  return failureCount < MAX_QUERY_RETRIES;
}

const MAX_QUERY_RETRIES = 3;
