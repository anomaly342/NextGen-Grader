import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types';
import type { FakeClockService } from '../fake-clock.service';
import type { FakeGoogleOAuthService } from '../fake-google-oauth.service';

/** The whole API, booted for e2e tests, with handles on its fakes. */
export interface E2eApp {
  readonly app: INestApplication<App>;
  /** Decides which Google account a `code` signs in as. */
  readonly google: FakeGoogleOAuthService;
  /** Server time; move it with `clock.advance(milliseconds)`. */
  readonly clock: FakeClockService;
  /** Wipes Postgres, Redis, rate-limit counters and fakes. Call in `beforeEach`. */
  resetState(): Promise<void>;
  /** Shuts the app down. Call in `afterAll`. */
  close(): Promise<void>;
}
