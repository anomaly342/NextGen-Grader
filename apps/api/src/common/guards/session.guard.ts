import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { SessionRequest } from '@/sessions/interfaces/session-request.interface';
import { SESSION_COOKIE_NAME } from '@/sessions/sessions.constants';
import { SessionsService } from '@/sessions/sessions.service';

/** Lets a request through only with a valid session cookie; attaches `req.sessionUser`. */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly sessionsService: SessionsService) {}

  /** Throws 401 NOT_SIGNED_IN when the cookie is missing, expired or tampered with. */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<SessionRequest>();
    const cookies = req.cookies as Record<string, string | undefined>;
    const cookieId = cookies[SESSION_COOKIE_NAME];
    const user = cookieId
      ? await this.sessionsService.getSession(cookieId)
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
