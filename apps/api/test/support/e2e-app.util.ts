import { INestApplication } from '@nestjs/common';
import { createServer, type RequestListener, type Server } from 'node:http';
import { getStorageToken } from '@nestjs/throttler';
import { Test } from '@nestjs/testing';
import { OAuth2Client as GoogleOAuthService } from 'google-auth-library';
import { Redis } from 'ioredis';
import { Client as PostgresClient } from 'pg';
import type { App } from 'supertest/types';
import { AppModule } from '@/app.module';
import { ClockService } from '@/clock/clock.service';
import { configureApp } from '@/common/utils/configure-app.util';
import { E2E_DATABASE_URL } from './e2e-env.constants';
import { FakeClockService } from './fake-clock.service';
import { FakeGoogleOAuthService } from './fake-google-oauth.service';
import type { E2eApp } from './interfaces/e2e-app.interface';
import { ResettableThrottlerStorageService } from './resettable-throttler-storage.service';

/** Empties every app table in the e2e database and restarts id sequences. */
async function truncateTables(postgresClient: PostgresClient): Promise<void> {
  const { rows } = await postgresClient.query<{ tablename: string }>(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public'",
  );
  if (!rows.length) return;
  const tables = rows.map(({ tablename }) => `"public"."${tablename}"`);
  await postgresClient.query(
    `TRUNCATE ${tables.join(', ')} RESTART IDENTITY CASCADE`,
  );
}

/**
 * Stands in for the web host: forwards every request to Nest, turning `/api/...`
 * into `/api/v1/...` like the `next.config.ts` rewrite (a rewrite, not a
 * redirect). The browser only ever sees the web host's paths, so cookie paths
 * are checked the way a real browser checks them.
 */
function createWebHost(app: INestApplication<App>): Server {
  const nestHandler = app.getHttpAdapter().getInstance() as RequestListener;
  return createServer((req, res) => {
    if (req.url?.startsWith('/api/')) {
      req.url = `/api/v1/${req.url.slice('/api/'.length)}`;
    }
    nestHandler(req, res);
  });
}

/**
 * Boots the real AppModule against the e2e Postgres and Redis. Only Google,
 * the clock and the rate-limit storage are swapped for test doubles.
 */
export async function createE2eApp(): Promise<E2eApp> {
  const google = new FakeGoogleOAuthService();
  const clock = new FakeClockService();
  const throttlerStorage = new ResettableThrottlerStorageService();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(GoogleOAuthService)
    .useValue(google)
    .overrideProvider(ClockService)
    .useValue(clock)
    .overrideProvider(getStorageToken())
    .useValue(throttlerStorage)
    .compile();
  const app = moduleRef.createNestApplication<INestApplication<App>>();
  configureApp(app);
  await app.init();
  const redis = app.get(Redis);
  const postgresClient = new PostgresClient({
    connectionString: E2E_DATABASE_URL,
  });
  await postgresClient.connect();
  return {
    app,
    webHost: createWebHost(app),
    google,
    clock,
    resetState: async (): Promise<void> => {
      await truncateTables(postgresClient);
      await redis.flushdb();
      throttlerStorage.reset();
      google.reset();
      clock.reset();
    },
    close: async (): Promise<void> => {
      await postgresClient.end();
      await app.close();
    },
  };
}
