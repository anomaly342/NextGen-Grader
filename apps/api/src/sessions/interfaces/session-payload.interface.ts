import type { SessionRecord } from './session-record.interface';
import type { SessionUser } from './session-user.interface';

/** JWT body of a session. Dates are ISO strings. `iat` and `exp` are added by the signer. */
export interface SessionPayload extends SessionUser {
  readonly kind: SessionRecord['kind'];
  readonly startedBy: SessionRecord['startedBy'];
  readonly credentialsSetAt: string | null;
  readonly lastLoginAt: string | null;
}
