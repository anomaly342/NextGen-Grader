import { Spinner } from '@repo/ui/spinner';

/** Shown while `/login` reads its search params. */
export default function LoginLoading() {
  return (
    <main className="bg-background flex flex-1 items-center justify-center">
      <Spinner className="text-muted-foreground size-6" />
    </main>
  );
}
