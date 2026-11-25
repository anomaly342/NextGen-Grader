import type { Request } from 'express';
import type { SessionPayload } from './session-payload.interface';

/** An Express request after SessionMiddleware has checked `ngg.sid`. */
export interface SessionRequest extends Request {
  session?: SessionPayload;
}
