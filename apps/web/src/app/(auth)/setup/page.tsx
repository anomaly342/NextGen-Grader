import { getSameSitePath } from '@repo/lib/auth/next-path';
import type { Metadata } from 'next';
import { BrandLockup } from '@/components/common/brand-lockup';
import { SetupCard } from '@/components/setup/setup-card';
import { requireCurrentUser } from '@/lib/current-user';

export const metadata: Metadata = {
  title: 'Set up your sign-in · NextGen Grader',
};

/**
 * `/setup` (Credential setup): the brand and the setup card for the signed-in
 * University account. The proxy keeps a User here until setup is done and
 * sends everyone else away; the redirect covers a session that ended since.
 */
export default async function SetupPage({ searchParams }: PageProps<'/setup'>) {
  const { next } = await searchParams;
  const user = await requireCurrentUser();

  return (
    <main className="bg-background flex flex-1 flex-col items-center gap-7 px-4 pt-[clamp(28px,7vh,80px)] pb-10">
      <BrandLockup />
      <SetupCard
        user={{ name: user.name, email: user.email }}
        next={getSameSitePath(next)}
      />
    </main>
  );
}
