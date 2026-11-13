import type { ModelRow } from '@repo/prisma';

/** The user as the API returns it. Never includes the password hash. */
export type UserDto = Pick<
  ModelRow<'User'>,
  | 'id'
  | 'email'
  | 'name'
  | 'username'
  | 'avatarUrl'
  | 'role'
  | 'credentialsSetAt'
>;
