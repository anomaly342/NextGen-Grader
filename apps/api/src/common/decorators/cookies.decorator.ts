import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { readCookie } from '@/common/utils/read-cookie.util';

/** One named cookie from the request, or undefined when it was not sent. */
export const Cookies = createParamDecorator(function readNamedCookie(
  name: string,
  context: ExecutionContext,
): string | undefined {
  const req = context.switchToHttp().getRequest<Request>();
  return readCookie(req, name);
});
