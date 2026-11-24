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
 * 204 or an empty body). Throws ApiError on any non-2xx answer.
 */
export async function apiRequest<T>(
  path: string,
  init: { method?: string; body?: unknown; signal?: AbortSignal } = {},
): Promise<T> {
  const hasBody = init.body !== undefined;
  const res = await fetch(`${API_BASE_PATH}${path}`, {
    method: init.method ?? 'GET',
    credentials: 'same-origin',
    headers: hasBody ? { 'Content-Type': 'application/json' } : undefined,
    body: hasBody ? JSON.stringify(init.body) : undefined,
    signal: init.signal,
  });
  if (!res.ok) throw await ApiError.fromResponse(res);
  if (res.status === 204 || res.headers.get('content-length') === '0') {
    return undefined as T;
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}
