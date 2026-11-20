import { ThrottlerStorage, ThrottlerStorageService } from '@nestjs/throttler';

/** What `increment` resolves to (not exported by @nestjs/throttler's index). */
type ThrottlerStorageRecord = Awaited<
  ReturnType<ThrottlerStorage['increment']>
>;

/** The in-memory throttler storage, plus a way to forget every counter between tests. */
export class ResettableThrottlerStorageService implements ThrottlerStorage {
  private inner = new ThrottlerStorageService();

  /** Counts a hit (delegates to Nest's in-memory storage). */
  increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    return this.inner.increment(key, ttl, limit, blockDuration, throttlerName);
  }

  /** Drops every counter and block. */
  reset(): void {
    this.inner.onApplicationShutdown();
    this.inner = new ThrottlerStorageService();
  }
}
