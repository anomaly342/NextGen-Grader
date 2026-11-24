import type { ModelRow } from '@repo/prisma';
import { getSameSitePath } from './next-path.ts';

/** What the proxy knows about the signed-in User (from `GET /auth/me`). */
type SignedInUser = Pick<ModelRow<'User'>, 'role' | 'credentialsSetAt'>;

/** One page navigation, as the proxy sees it. */
interface Navigation {
  pathname: string;
  /** The query string with its leading `?`, or `''`. */
  search: string;
  /** null when there is no cookie or the session is not current. */
  user: SignedInUser | null;
}

/** Where the proxy sends this navigation, or null to let it through. */
export function getAuthRedirect({
  pathname,
  search,
  user,
}: Navigation): string | null {
  const here = `${pathname}${search}`;
  if (!user) {
    return pathname === LOGIN_PATH ? null : withNext(LOGIN_PATH, here);
  }
  if (user.credentialsSetAt == null) {
    if (pathname === SETUP_PATH) return null;
    const next =
      pathname === LOGIN_PATH ? new URLSearchParams(search).get('next') : here;
    return withNext(SETUP_PATH, next);
  }
  if (pathname === LOGIN_PATH || pathname === SETUP_PATH) return HOME_PATH;
  if (pathname === HOME_PATH) return getLandingPath(user.role);
  return null;
}

const HOME_PATH = '/';
const LOGIN_PATH = '/login';
const SETUP_PATH = '/setup';

/** Where `/` takes a User. Everyone lands on `/classrooms` until Teacher routes are decided. */
function getLandingPath(role: SignedInUser['role']): string {
  switch (role) {
    case 'STUDENT':
    case 'TEACHER':
      return '/classrooms';
  }
}

/** `page?next=<next>`, or just `page` when `next` is not a same-site path. */
function withNext(page: string, next: string | null): string {
  const safeNext = getSameSitePath(next);
  return safeNext
    ? `${page}?${new URLSearchParams({ next: safeNext }).toString()}`
    : page;
}
