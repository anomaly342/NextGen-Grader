import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Redis } from 'ioredis';
import { randomUUID } from 'node:crypto';
import { SessionUser } from './interfaces/session-user.interface';
import { SESSION_TTL_SECONDS } from './sessions.constants';

/**
 * Stores sessions in Redis as `{cookieId} -> {jwt}`, where the JWT decodes
 * to the session's user body.
 */
@Injectable()
export class SessionsService {
  constructor(
    private readonly redis: Redis,
    private readonly jwtService: JwtService,
  ) {}

  /** Creates a session for `user` and returns the new cookie id. */
  async createSession(user: SessionUser): Promise<string> {
    const cookieId = randomUUID();
    const token = await this.jwtService.signAsync(
      { ...user },
      { expiresIn: SESSION_TTL_SECONDS },
    );
    await this.redis.set(cookieId, token, 'EX', SESSION_TTL_SECONDS);
    return cookieId;
  }

  /** Returns the session's user, or `null` if it is missing, expired or tampered with. */
  async getSession(cookieId: string): Promise<SessionUser | null> {
    const token = await this.redis.get(cookieId);
    if (!token) return null;
    try {
      const payload = await this.jwtService.verifyAsync<SessionUser>(token);
      // Pick the user fields only, dropping JWT claims like `iat` / `exp`.
      return {
        id: payload.id,
        email: payload.email,
        name: payload.name,
        avatarUrl: payload.avatarUrl,
        role: payload.role,
      };
    } catch {
      return null;
    }
  }

  /** Deletes the session (logout). */
  async destroySession(cookieId: string): Promise<void> {
    await this.redis.del(cookieId);
  }
}
