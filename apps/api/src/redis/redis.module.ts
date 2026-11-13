import { Global, Module, OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';

/**
 * Provides one shared Redis client, injectable anywhere as `Redis`.
 * Reads `REDIS_URL`, e.g. `redis://:password@localhost:6379`.
 */
@Global()
@Module({
  providers: [
    {
      provide: Redis,
      useFactory: (): Redis => new Redis(process.env['REDIS_URL']!),
    },
  ],
  exports: [Redis],
})
export class RedisModule implements OnModuleDestroy {
  constructor(private readonly redis: Redis) {}

  /** Closes the Redis connection when Nest shuts down. */
  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }
}
