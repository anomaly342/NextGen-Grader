import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { readCookie } from '@/common/utils/read-cookie.util';
import type { SessionRequest } from '@/sessions/interfaces/session-request.interface';
import { SESSION_COOKIE_NAME } from '@/sessions/sessions.constants';
import { SessionsService } from '@/sessions/sessions.service';

/**
 * Lets a request through only with a current User session in `ngg.sid`.
 * Reads that cookie only. `kind` other than `USER` is 401 NOT_SIGNED_IN.
 * Attaches `req.sessionUser`.
 */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly sessionsService: SessionsService) {}

  /** Throws 401 NOT_SIGNED_IN when `ngg.sid` is missing or is not a current User session. */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<SessionRequest>();
    const cookieId = readCookie(req, SESSION_COOKIE_NAME);
    const user = cookieId
      ? await this.sessionsService.getUserSession(cookieId)
      : null;
    if (!user) {
      throw new UnauthorizedException({
        code: 'NOT_SIGNED_IN',
        message: 'Sign in first',
      });
    }
    req.sessionUser = user;
    return true;
  }
}
