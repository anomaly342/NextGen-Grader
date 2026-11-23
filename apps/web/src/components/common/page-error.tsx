'use client';

import { Button } from '@repo/ui/button';

/** Full-page message for a route's `error.tsx`: what failed, and "Try again". */
export function PageError({
  title,
  retry,
}: {
  /** What did not load, e.g. "The sign-in page did not load". */
  title: string;
  /** The `retry` that Next passes to `error.tsx`; renders the route again. */
  retry: () => void;
}) {
  return (
    <main className="bg-background flex flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
      <p className="text-muted-foreground">
        Check your connection and try again.
      </p>
      <Button size="lg" className="h-11 px-5 font-bold" onClick={retry}>
        Try again
      </Button>
    </main>
  );
}
