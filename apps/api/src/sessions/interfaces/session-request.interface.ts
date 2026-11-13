import type { Request } from 'express';
import type { SessionUser } from './session-user.interface';

/** An Express request after SessionGuard has attached the signed-in user. */
export interface SessionRequest extends Request {
  sessionUser?: SessionUser;
}
