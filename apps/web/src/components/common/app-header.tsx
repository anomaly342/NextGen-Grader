import Link from 'next/link';
import type { ReactNode } from 'react';
import { Logo } from '@/components/common/logo';

/** The top bar of every signed-in page: the logo home link, then `children` (the user menu) on the right. */
export function AppHeader({ children }: { children?: ReactNode }) {
  return (
    <header className="bg-card sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b px-3 md:px-8">
      <Link
        href="/"
        className="focus-visible:ring-ring/50 flex min-h-11 items-center gap-2.5 rounded-lg text-base font-extrabold tracking-tight focus-visible:ring-3 focus-visible:outline-none"
      >
        <Logo className="size-7 p-1.25" />
        NextGen Grader
      </Link>
      {children}
    </header>
  );
}
