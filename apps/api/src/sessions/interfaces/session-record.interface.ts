import type { ModelRow } from '@repo/prisma';
import type { SessionUser } from './session-user.interface';

/**
 * The session record stored in Redis.
 * `kind: EXAMINEE` is reserved for exam mode and is not accepted on User routes.
 * `kind` and `startedBy` are not columns on `User`.
 */
export interface SessionRecord {
  readonly kind: 'USER' | 'EXAMINEE';
  /** `User.id` now. Later an Examinee id. */
  readonly id: ModelRow<'User'>['id'];
  readonly user: SessionUser;
  readonly credentialsSetAt: ModelRow<'User'>['credentialsSetAt'];
  /** How this session was started. */
  readonly startedBy: 'GOOGLE' | 'PASSWORD';
  readonly lastLoginAt: ModelRow<'User'>['lastLoginAt'];
}
