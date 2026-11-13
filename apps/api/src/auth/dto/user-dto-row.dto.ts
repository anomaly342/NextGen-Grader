import type { ModelRow } from '@repo/prisma';

/** The `User` columns a UserDto (and the session user) is built from. */
export type UserDtoRow = Pick<
  ModelRow<'User'>,
  | 'id'
  | 'email'
  | 'name'
  | 'username'
  | 'avatarUrl'
  | 'role'
  | 'credentialsSetAt'
>;
