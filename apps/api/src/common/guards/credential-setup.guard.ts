import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { SKIP_CREDENTIAL_SETUP_KEY } from '@/common/decorators/skip-credential-setup.constants';
import { readCookie } from '@/common/utils/read-cookie.util';
import { SESSION_COOKIE_NAME } from '@/sessions/sessions.constants';
import { SessionsService } from '@/sessions/sessions.service';

/**
 * While a User session says Credential setup is not done, every route returns
 * 403 CREDENTIAL_SETUP_REQUIRED except those marked `@SkipCredentialSetup()`.
 * No session, or a session that is not a current User session, is left alone.
 */
@Injectable()
export class CredentialSetupGuard implements CanActivate {
  constructor(
    private readonly sessionsService: SessionsService,
    private readonly reflector: Reflector,
  ) {}

  /** Throws 403 CREDENTIAL_SETUP_REQUIRED when this User session still needs setup. */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;
    const isExempt = this.reflector.getAllAndOverride<boolean>(
      SKIP_CREDENTIAL_SETUP_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (isExempt) return true;
    const req = context.switchToHttp().getRequest<Request>();
    const cookieId = readCookie(req, SESSION_COOKIE_NAME);
    if (!cookieId) return true;
    const session = await this.sessionsService.findCurrentUserSession(cookieId);
    if (!session || session.credentialsSetAt != null) return true;
    throw new ForbiddenException({
      code: 'CREDENTIAL_SETUP_REQUIRED',
      message: 'Finish Credential setup first',
    });
  }
}
