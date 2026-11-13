import type { ModelRow } from '@repo/prisma';

/** The parts of a verified Google ID token we store on the `User` row. */
export type GoogleProfile = Pick<
  ModelRow<'User'>,
  'googleId' | 'email' | 'name' | 'avatarUrl'
>;
