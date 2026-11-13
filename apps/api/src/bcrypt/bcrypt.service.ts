import { Injectable } from '@nestjs/common';
import { compare, hash } from 'bcrypt';
import { BCRYPT_SALT_ROUNDS } from './bcrypt.constants';

/** One-way password hashing with bcrypt. Hashes can be verified, never decrypted. */
@Injectable()
export class BcryptService {
  /** Hashes `plain` with a fresh random salt (stored inside the returned hash). */
  hash(plain: string): Promise<string> {
    return hash(plain, BCRYPT_SALT_ROUNDS);
  }

  /** True if `plain` matches `hashed`. */
  verify(plain: string, hashed: string): Promise<boolean> {
    return compare(plain, hashed);
  }
}
