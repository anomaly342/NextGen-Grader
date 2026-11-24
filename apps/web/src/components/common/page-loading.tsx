import { Spinner } from '@repo/ui/spinner';

/** Full-page spinner for a route's `loading.tsx`. */
export function PageLoading() {
  return (
    <main className="bg-background flex flex-1 items-center justify-center">
      <Spinner className="text-muted-foreground size-6" />
    </main>
  );
}
