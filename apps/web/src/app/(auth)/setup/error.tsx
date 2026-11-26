'use client';

import { PageError } from '@/components/common/page-error';

/** Shown when `/setup` fails to render; `retry` renders it again. */
export default function Error({ retry }: { retry: () => void }) {
  return <PageError title="The setup page did not load" retry={retry} />;
}
