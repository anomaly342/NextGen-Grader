import type { User } from '@repo/prisma';

/** A `User` as it arrives in JSON: dates are ISO strings. */
type UserJson = Omit<User, 'credentialsSetAt'> & {
  readonly credentialsSetAt: string | null;
};

/** Turns the `GET /auth/me` JSON body into a `User`, with `credentialsSetAt` as a date (null stays null). */
export function parseUser(body: UserJson): User {
  return {
    ...body,
    credentialsSetAt:
      body.credentialsSetAt === null ? null : new Date(body.credentialsSetAt),
  };
}
