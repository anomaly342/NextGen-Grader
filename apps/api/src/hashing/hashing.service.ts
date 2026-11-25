import { Injectable } from '@nestjs/common';
import { BcryptService } from '@/bcrypt/bcrypt.service';
import { DUMMY_PASSWORD_HASH } from './hashing.constants';

/**
 * Password hashing for sign-in and password changes. Use this, not BcryptService:
 * `verify` takes a missing hash and still spends the same time, so callers can't
 * leak which usernames exist.
 */
@Injectable()
export class HashingService {
  constructor(private readonly bcryptService: BcryptService) {}

  /** Hashes `plain` with a fresh random salt (stored inside the returned hash). */
  hash(plain: string): Promise<string> {
    return this.bcryptService.hash(plain);
  }

  /**
   * True if `plain` matches `hashed`. A null `hashed` (no such User, or no
   * password set yet) is always false, after a bcrypt check against a dummy
   * hash so it takes as long as a wrong password.
   */
  async verify(plain: string, hashed: string | null): Promise<boolean> {
    const isMatch = await this.bcryptService.verify(
      plain,
      hashed ?? DUMMY_PASSWORD_HASH,
    );
    return hashed !== null && isMatch;
  }
}
