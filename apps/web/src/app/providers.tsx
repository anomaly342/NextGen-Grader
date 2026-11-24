'use client';

import { Toaster } from '@repo/ui/sonner';
import type { ReactNode } from 'react';
import { QueryProvider } from '@/providers/query-provider';

/** Client-side providers for the whole app. */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryProvider>
      {children}
      <Toaster />
    </QueryProvider>
  );
}
