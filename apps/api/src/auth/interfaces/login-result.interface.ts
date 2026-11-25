import type { User } from '@repo/prisma';

/** A new session cookie id and the user it belongs to. */
export interface LoginResult {
  readonly cookieId: string;
  readonly user: User;
}
