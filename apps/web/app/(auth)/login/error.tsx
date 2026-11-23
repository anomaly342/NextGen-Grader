'use client';

import { Button } from '@repo/ui/button';

/** Shown when `/login` fails to render; `retry` renders it again. */
export default function LoginError({ retry }: { retry: () => void }) {
  return (
    <main className="bg-background flex flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-extrabold tracking-tight">
        The sign-in page did not load
      </h1>
      <p className="text-muted-foreground">
        Check your connection and try again.
      </p>
      <Button size="lg" className="h-11 px-5 font-bold" onClick={retry}>
        Try again
      </Button>
    </main>
  );
}
