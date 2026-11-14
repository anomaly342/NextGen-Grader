import type { UserDto } from '@/auth/dto/user.dto';

/** Result of a successful password login: the new session and the signed-in user. */
export interface LoginResult {
  readonly cookieId: string;
  readonly user: UserDto;
}
