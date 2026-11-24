import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { SessionPayload } from '@/sessions/interfaces/session-payload.interface';
import type { SessionRequest } from '@/sessions/interfaces/session-request.interface';

/** The current User session. Use only on routes behind `@UseGuards(SessionGuard)`. */
export const CurrentSession = createParamDecorator(function readCurrentSession(
  _data: unknown,
  context: ExecutionContext,
): SessionPayload {
  return context.switchToHttp().getRequest<SessionRequest>().session!;
});
