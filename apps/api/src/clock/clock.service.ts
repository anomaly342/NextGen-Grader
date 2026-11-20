import { Injectable } from '@nestjs/common';

/**
 * The server clock. Services read the current time from here instead of
 * `new Date()`, so e2e tests can swap in a clock they move forward.
 */
@Injectable()
export class ClockService {
  /** The current server time. */
  now(): Date {
    return new Date();
  }
}
