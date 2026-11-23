import { getSameSitePath } from '@repo/lib/auth/next-path';
import type { Metadata } from 'next';
import { Logo } from '@/components/common/logo';
import { LoginCard } from '@/components/login/login-card';

export const metadata: Metadata = { title: 'Sign in · NextGen Grader' };

/** `/login`: the brand, the sign-in card and a shared-computer reminder. */
export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const { next, error } = await searchParams;
  return (
    <main className="bg-background flex flex-1 flex-col items-center gap-7 px-4 pt-[clamp(28px,9vh,96px)] pb-10">
      <div className="flex items-center gap-2.5">
        <Logo />
        <p className="flex flex-col leading-tight">
          <strong className="text-lg font-extrabold tracking-tight">
            NextGen Grader
          </strong>
          <small className="text-muted-foreground text-xs font-semibold">
            KMUTNB
          </small>
        </p>
      </div>
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
