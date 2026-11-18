import type { Request } from 'express';

/** The named cookie on `req`, or undefined when the browser did not send it. */
export const readCookie = (req: Request, name: string): string | undefined => {
  const cookies = req.cookies as Record<string, string | undefined> | undefined;
  return cookies?.[name];
};
