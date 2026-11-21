import { ApiError } from './api-error.ts';

/**
 * The browser client. Relative URLs only: the web app's `next.config` rewrites
 * `/api` to Nest's `/api/v1`, so this code never knows the Nest host and
 * `ngg.sid` stays a first-party cookie. Use it inside TanStack Query
 * `queryFn` / `mutationFn`; the QueryClient's error handler passes failures to
 * `redirectOnAuthError` (see `auth-error-redirect.ts`).
 */

/** Browser-visible prefix of every API route. */
export const API_BASE_PATH = '/api';

/**
 * Calls `API_BASE_PATH + path` and returns the parsed JSON body (undefined on
 * 204). Throws ApiError on any non-2xx answer.
 */
export async function apiRequest<T>(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  const hasBody = init.body !== undefined;
  const res = await fetch(`${API_BASE_PATH}${path}`, {
    method: init.method ?? 'GET',
    credentials: 'same-origin',
    headers: hasBody ? { 'Content-Type': 'application/json' } : undefined,
    body: hasBody ? JSON.stringify(init.body) : undefined,
  });
  if (!res.ok) throw await ApiError.fromResponse(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
