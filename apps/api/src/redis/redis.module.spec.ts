import { Test, TestingModule } from '@nestjs/testing';
import { Redis } from 'ioredis';
import { once } from 'node:events';
import { RedisModule } from './redis.module';

/** Same default as docker-compose.yml; CI sets REDIS_URL to its service container. */
const DEFAULT_REDIS_URL = 'redis://:redis@localhost:6379';

/** Integration test: needs a running Redis (`docker compose up -d redis`). */
describe('RedisModule', () => {
  let module: TestingModule;
  let redis: Redis;

  beforeAll(async () => {
    process.env['REDIS_URL'] ??= DEFAULT_REDIS_URL;
    module = await Test.createTestingModule({
      imports: [RedisModule],
    }).compile();
    redis = module.get(Redis);
  });

  afterAll(async () => {
    await module.close();
  });

  it('connects and answers PING', async () => {
    const actualReply = await redis.ping();
    expect(actualReply).toBe('PONG');
  });

  it('writes, reads, expires and deletes a key', async () => {
    const inputKey = `test:${crypto.randomUUID()}`;
    const inputValue = 'hello';
    await redis.set(inputKey, inputValue, 'EX', 60);
    const actualValue = await redis.get(inputKey);
    const actualTtl = await redis.ttl(inputKey);
    await redis.del(inputKey);
    const actualAfterDelete = await redis.get(inputKey);
    expect(actualValue).toBe(inputValue);
    expect(actualTtl).toBeGreaterThan(0);
    expect(actualAfterDelete).toBeNull();
  });

  it('closes the connection when the module is destroyed', async () => {
    const closingModule = await Test.createTestingModule({
      imports: [RedisModule],
    }).compile();
    const closingRedis = closingModule.get(Redis);
    await closingRedis.ping();
    // ioredis emits "end" shortly after quit() resolves, so wait for it.
    const ended = once(closingRedis, 'end');
    await closingModule.close();
    await ended;
    expect(closingRedis.status).toBe('end');
  });
});
