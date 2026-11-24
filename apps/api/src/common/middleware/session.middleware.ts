import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Response } from 'express';
import { readCookie } from '@/common/utils/read-cookie.util';
import type { SessionRequest } from '@/sessions/interfaces/session-request.interface';
import { SESSION_COOKIE_NAME } from '@/sessions/sessions.constants';
import { SessionsService } from '@/sessions/sessions.service';

/**
 * Loads the current User session from `ngg.sid` onto `req.session` once per
 * HTTP request so guards and route handlers do not hit Redis again.
 */
@Injectable()
export class SessionMiddleware implements NestMiddleware {
  constructor(private readonly sessionsService: SessionsService) {}

  /** Attaches `req.session` when `ngg.sid` matches a current User session. */
  async use(
    req: SessionRequest,
    _res: Response,
    next: NextFunction,
  ): Promise<void> {
    const cookieId = readCookie(req, SESSION_COOKIE_NAME);
    if (cookieId) {
      const session =
        await this.sessionsService.findCurrentUserSession(cookieId);
      if (session) req.session = session;
    }
    next();
  }
}
