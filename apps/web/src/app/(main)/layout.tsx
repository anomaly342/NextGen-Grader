import { Suspense, type ReactNode } from 'react';
import { AppHeader } from '@/components/common/app-header';
import { UserMenu } from '@/components/common/user-menu';
import { requireCurrentUser } from '@/lib/current-user';

/** Layout for every page behind sign-in: the app header with the user menu. */
export default function MainLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <AppHeader>
        <Suspense fallback={<span aria-hidden className="size-11" />}>
          <CurrentUserMenu />
        </Suspense>
      </AppHeader>
      {children}
    </>
  );
}

/** The user menu for the signed-in User. The proxy already sent everyone else to `/login`. */
async function CurrentUserMenu() {
  const user = await requireCurrentUser();
  return <UserMenu user={{ name: user.name, email: user.email }} />;
}
