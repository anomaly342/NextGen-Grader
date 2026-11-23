'use client';

import { Toaster } from '@repo/ui/sonner';
import type { ReactNode } from 'react';
import { QueryProvider } from '@/providers/query-provider';

/** Client-side providers for the whole app. */
export function Providers({ children }: ProvidersProps) {
  return (
    <QueryProvider>
      {children}
      <Toaster />
    </QueryProvider>
  );
}

interface ProvidersProps {
  children: ReactNode;
}
