import { getSameSitePath } from '@repo/lib/auth/next-path';
import type { Metadata } from 'next';
import { BrandLockup } from '@/components/common/brand-lockup';
import { LoginCard } from '@/components/login/login-card';

export const metadata: Metadata = { title: 'Sign in · NextGen Grader' };

/** `/login`: the brand, the sign-in card and a shared-computer reminder. */
export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const { next, error } = await searchParams;
  return (
    <main className="bg-background flex flex-1 flex-col items-center gap-7 px-4 pt-[clamp(28px,9vh,96px)] pb-10">
      <BrandLockup />
      <LoginCard
        next={getSameSitePath(next)}
        errorCode={typeof error === 'string' ? error : null}
      />
      <p className="text-muted-foreground max-w-105 text-center text-sm">
        On a shared lab computer? Log out when you finish.
      </p>
    </main>
  );
}
