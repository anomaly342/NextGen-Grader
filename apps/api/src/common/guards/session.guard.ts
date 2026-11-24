import { AUTH_ERROR_CODE } from '@repo/lib/auth/error-codes';
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { SessionRequest } from '@/sessions/interfaces/session-request.interface';

/**
 * Lets a request through only when SessionMiddleware attached a current User
 * session from `ngg.sid`. Missing, expired or `EXAMINEE` sessions get 401 NOT_SIGNED_IN.
 */
@Injectable()
export class SessionGuard implements CanActivate {
  /** Throws 401 NOT_SIGNED_IN when `req.session` was not attached. */
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<SessionRequest>();
    if (!req.session) {
      throw new UnauthorizedException({
        code: AUTH_ERROR_CODE.NOT_SIGNED_IN,
        message: 'Sign in first',
      });
    }
    return true;
  }
}
