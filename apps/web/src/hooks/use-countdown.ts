'use client';

import { useEffect, useState } from 'react';

const MS_PER_SECOND = 1000;

/**
 * A display-only countdown: `startCountdown(seconds)` starts it, `secondsLeft`
 * reaches 0 at the end. It keeps the end time and reads the clock, so it does
 * not drift, and runs one interval per countdown, not an effect per tick.
 */
export function useCountdown() {
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (endsAt === null) return;
    const timer = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= endsAt) clearInterval(timer);
    }, MS_PER_SECOND);
    return () => clearInterval(timer);
  }, [endsAt]);
  const startCountdown = (seconds: number): void => {
    const current = Date.now();
    setNow(current);
    setEndsAt(current + seconds * MS_PER_SECOND);
  };
  const secondsLeft =
    endsAt === null
      ? 0
      : Math.max(0, Math.ceil((endsAt - now) / MS_PER_SECOND));
  return { secondsLeft, startCountdown };
}
