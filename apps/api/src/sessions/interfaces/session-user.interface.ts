import type { ModelRow } from '@repo/prisma';

/** The user body stored in a session's JWT: a subset of the Prisma `User` row. */
export type SessionUser = Pick<
  ModelRow<'User'>,
  'id' | 'email' | 'name' | 'avatarUrl' | 'role'
>;
