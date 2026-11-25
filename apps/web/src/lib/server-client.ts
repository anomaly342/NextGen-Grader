import { ApiError } from '@repo/lib/api/api-error';
import { parseUser } from '@repo/lib/api/parse-user';
import type { User } from '@repo/prisma';

/**
 * The server-only client, for the proxy (middleware) and server components.
 * It is the only code that knows the Nest host (`API_INTERNAL_URL`) and it
 * forwards the incoming request's cookies. Never import it from a client component.
 */

/** Same default as `next.config`'s `/api` rewrite. */
const DEFAULT_API_INTERNAL_URL = 'http://localhost:4000';

/** Nest's global prefix. */
const API_PREFIX = '/api/v1';

/**
 * A client that sends `cookie` (the incoming request's `Cookie` header) with
 * every call. Proxy: `request.headers.get('cookie')`. Server component:
 * `(await headers()).get('cookie')`.
 */
export function createServerClient(cookie: string | null) {
  const baseUrl = (
    process.env['API_INTERNAL_URL'] ?? DEFAULT_API_INTERNAL_URL
  ).replace(/\/+$/, '');

  return {
    /**
     * The signed-in User, or null when there is no cookie or the session is
     * not current (401 `NOT_SIGNED_IN`). Throws ApiError on any other failure.
     */
    async getMe(): Promise<User | null> {
      if (!cookie) return null;
      const res = await fetch(`${baseUrl}${API_PREFIX}/auth/me`, {
        headers: { cookie },
        cache: 'no-store',
      });
      if (res.status === 401) return null;
      if (!res.ok) throw await ApiError.fromResponse(res);
      return parseUser(await res.json());
    },
  };
}
