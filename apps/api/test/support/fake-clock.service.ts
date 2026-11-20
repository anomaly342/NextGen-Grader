import { ClockService } from '@/clock/clock.service';

/** Where every test's clock starts. */
const START_TIME = new Date('2026-11-01T09:00:00.000Z');

/** A clock that stands still until the test moves it forward. */
export class FakeClockService extends ClockService {
  private current: Date = START_TIME;

  /** Puts the clock back to the start time. */
  reset(): void {
    this.current = START_TIME;
  }

  /** The frozen time. */
  override now(): Date {
    return new Date(this.current);
  }

  /** Moves the clock forward by `milliseconds`. */
  advance(milliseconds: number): void {
    this.current = new Date(this.current.getTime() + milliseconds);
  }
}
