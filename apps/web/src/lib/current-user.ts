import { LOGIN_PATH } from '@repo/lib/auth/next-path';
import type { User } from '@repo/prisma';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { createServerClient } from '@/lib/server-client';

/**
 * The current User for server components. Server-only: never import it from a
 * client component. The proxy checks `GET /auth/me` on its own; it does not
 * hand the User over (see ADR 0004), so a page load makes two calls.
 */

/**
 * The signed-in User, or null when signed out. Cached per render, so the
 * layout and the page share one `GET /auth/me`.
 */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const cookie = (await headers()).get('cookie');
  return createServerClient(cookie).getMe();
});

/**
 * The signed-in User, or a redirect to plain `/login`. Only a fallback for a
 * Session that ended after the proxy let the request through; the proxy owns
 * `next=`, so this does not add it.
 */
export async function requireCurrentUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect(LOGIN_PATH);
  return user;
}
