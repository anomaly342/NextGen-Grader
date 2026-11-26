'use client';

import { PageError } from '@/components/common/page-error';

/** Shown when `/account/reset-password` fails to render; `retry` renders it again. */
export default function Error({ retry }: { retry: () => void }) {
  return (
    <PageError title="The password reset page did not load" retry={retry} />
  );
}
