import { AUTH_ERROR_CODE } from '../auth/error-codes.ts';
import { LOGIN_PATH, SETUP_PATH, withNext } from '../auth/next-path.ts';
import { ApiError } from './api-error.ts';

/** The part of a TanStack QueryClient this needs. */
interface ClearableCache {
  clear(): void;
}

/** The part of `window.location` this needs. */
type BrowserLocation = Pick<Location, 'pathname' | 'search' | 'assign'>;

/**
 * The one place the browser handles auth errors. Wire it into the QueryClient's
 * QueryCache and MutationCache `onError`:
 *
 * - 401 `NOT_SIGNED_IN`: clears the query cache (no stale data from the old
 *   session) and goes to `/login?next=<current page>`.
 * - 403 `CREDENTIAL_SETUP_REQUIRED`: goes to `/setup?next=<current page>`.
 *
 * Returns true when it redirected. Any other error is left to the caller.
 */
export function redirectOnAuthError(
  error: unknown,
  queryClient: ClearableCache,
  location: BrowserLocation = window.location,
): boolean {
  if (!(error instanceof ApiError)) return false;
  if (error.status === 401 && error.code === AUTH_ERROR_CODE.NOT_SIGNED_IN) {
    queryClient.clear();
    goTo(LOGIN_PATH, location);
    return true;
  }
  if (
    error.status === 403 &&
    error.code === AUTH_ERROR_CODE.CREDENTIAL_SETUP_REQUIRED
  ) {
    goTo(SETUP_PATH, location);
    return true;
  }
  return false;
}

/**
 * Goes to `page?next=<current page>`. Does nothing when already on `page`:
 * reloading it would re-run the failing query and loop.
 */
function goTo(page: string, location: BrowserLocation): void {
  if (location.pathname === page) return;
  location.assign(withNext(page, `${location.pathname}${location.search}`));
}
