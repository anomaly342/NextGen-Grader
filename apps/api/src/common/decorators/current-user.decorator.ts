import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { SessionRequest } from '@/sessions/interfaces/session-request.interface';
import type { SessionUser } from '@/sessions/interfaces/session-user.interface';

/** The signed-in User. Use only on routes behind `@UseGuards(SessionGuard)`. */
export const CurrentUser = createParamDecorator(function readSessionUser(
  _data: unknown,
  context: ExecutionContext,
): SessionUser {
  const { session } = context.switchToHttp().getRequest<SessionRequest>();
  return {
    id: session!.id,
    email: session!.email,
    name: session!.name,
    avatarUrl: session!.avatarUrl,
    role: session!.role,
  };
});
