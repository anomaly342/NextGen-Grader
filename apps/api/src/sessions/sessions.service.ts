import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Redis } from 'ioredis';
import { randomUUID } from 'node:crypto';
import { SessionPayload } from './interfaces/session-payload.interface';
import { SessionRecord } from './interfaces/session-record.interface';
import { SessionUser } from './interfaces/session-user.interface';
import { SESSION_KEY_PREFIX, SESSION_TTL_SECONDS } from './sessions.constants';

/**
 * One session per account per kind, stored in Redis.
 * The cookie id maps to a JWT of the session record. A pointer maps
 * kind + account id to that cookie id.
 */
@Injectable()
export class SessionsService {
  constructor(
    private readonly redisService: Redis,
    private readonly jwtService: JwtService,
  ) {}

  /** Creates a session for `record` and returns the new cookie id. Ends the previous one. */
  async createSession(record: SessionRecord): Promise<string> {
    const cookieId = randomUUID();
    const token = await this.jwtService.signAsync(this.toPayload(record), {
      expiresIn: SESSION_TTL_SECONDS,
    });
    const sessionKey = this.buildSessionKey(cookieId);
    await this.redisService.set(sessionKey, token, 'EX', SESSION_TTL_SECONDS);
    const previous = await this.redisService.set(
      this.buildPointerKey(record.kind, record.id),
      cookieId,
      'EX',
      SESSION_TTL_SECONDS,
      'GET',
    );
    if (typeof previous === 'string' && previous !== cookieId) {
      await this.redisService.del(this.buildSessionKey(previous));
    }
    return cookieId;
  }

  /**
   * Returns the user body of a current User session.
   * Null when the cookie is missing, expired, tampered with, no longer the
   * account's current session, or not `kind: USER`.
   */
  async getUserSession(cookieId: string): Promise<SessionUser | null> {
    const payload = await this.findCurrentUserSession(cookieId);
    if (!payload) return null;
    return this.toSessionUser(payload);
  }

  /**
   * The current User session behind `cookieId`, or null when it is not one.
   * `credentialsSetAt` is the copy frozen when the session was opened.
   */
  async findCurrentUserSession(
    cookieId: string,
  ): Promise<SessionPayload | null> {
    const payload = await this.readPayload(cookieId);
    if (!payload || payload.kind !== 'USER') return null;
    const pointer = await this.redisService.get(
      this.buildPointerKey(payload.kind, payload.id),
    );
    if (pointer !== cookieId) return null;
    return payload;
  }

  /** Deletes the session and, when it is still current, its pointer. */
  async destroySession(cookieId: string): Promise<void> {
    const payload = await this.readPayload(cookieId);
    await this.redisService.del(this.buildSessionKey(cookieId));
    if (!payload) return;
    await this.deletePointerIfCurrent(
      this.buildPointerKey(payload.kind, payload.id),
      cookieId,
    );
  }

  /**
   * Deletes `pointerKey` only while it still stores `cookieId`.
   * Uses its own connection so a sign-in on the shared client cannot
   * clear the watch or lose the pointer of a newer session.
   */
  private async deletePointerIfCurrent(
    pointerKey: string,
    cookieId: string,
  ): Promise<void> {
    const redis = this.redisService.duplicate();
    try {
      for (;;) {
        await redis.watch(pointerKey);
        const current = await redis.get(pointerKey);
        if (current !== cookieId) return;
        const swapped = await redis.multi().del(pointerKey).exec();
        if (swapped) return;
      }
    } finally {
      redis.disconnect();
    }
  }

  /** The JWT claims stored for `record`. */
  private toPayload(record: SessionRecord): SessionPayload {
    return {
      ...record.user,
      id: record.id,
      kind: record.kind,
      credentialsSetAt: record.credentialsSetAt?.toISOString() ?? null,
      startedBy: record.startedBy,
      lastLoginAt: record.lastLoginAt?.toISOString() ?? null,
    };
  }

  /** The user body, dropping session and JWT claims. */
  private toSessionUser(payload: SessionPayload): SessionUser {
    return {
      id: payload.id,
      email: payload.email,
      name: payload.name,
      avatarUrl: payload.avatarUrl,
      role: payload.role,
    };
  }

  /** Redis key of the session record for `cookieId`. */
  private buildSessionKey(cookieId: string): string {
    return `${SESSION_KEY_PREFIX}${cookieId}`;
  }

  /**
   * Redis key of the pointer from one account to its current cookie id.
   * A User and an Examinee with the same numeric id do not share a pointer.
   */
  private buildPointerKey(kind: SessionRecord['kind'], id: number): string {
    return `ngg:session:pointer:${kind}:${id}`;
  }

  /** Decodes the session JWT, or null when the key is missing or the JWT is bad. */
  private async readPayload(cookieId: string): Promise<SessionPayload | null> {
    const token = await this.redisService.get(this.buildSessionKey(cookieId));
    if (!token) return null;
    try {
      return await this.jwtService.verifyAsync<SessionPayload>(token);
    } catch {
      return null;
    }
  }
}
