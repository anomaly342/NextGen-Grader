import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { SessionRequest } from '@/sessions/interfaces/session-request.interface';
import type { SessionUser } from '@/sessions/interfaces/session-user.interface';

/** The signed-in user. Use only on routes behind `@UseGuards(SessionGuard)`. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): SessionUser => {
    const req = context.switchToHttp().getRequest<SessionRequest>();
    return req.sessionUser!;
  },
);
