import { getAuthRedirect } from '@repo/lib/auth/auth-redirect';
import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@/lib/server-client';

/**
 * Checks every page navigation against `GET /auth/me` and sends the User to
 * `/login`, `/setup`, `/` or their landing page as `getAuthRedirect` decides.
 * It only routes; the API still checks the session on every call.
 */
export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname, search } = request.nextUrl;
  const user = await createServerClient(request.headers.get('cookie')).getMe();
  const redirectPath = getAuthRedirect({ pathname, search, user });
  if (redirectPath === null) return NextResponse.next();
  return NextResponse.redirect(new URL(redirectPath, request.url));
}

/** Which requests the proxy runs on. */
export const config = {
  matcher: [
    // Pages only: not the `/api` rewrite, Next's own files or files with an extension.
    '/((?!api/|_next/static|_next/image|.*\\.[^/]+$).*)',
  ],
};
