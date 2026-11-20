import type { UserDto } from '@/auth/dto/user.dto';

/** A new session cookie id and the user it belongs to. */
export interface LoginResult {
  readonly cookieId: string;
  readonly user: UserDto;
}
