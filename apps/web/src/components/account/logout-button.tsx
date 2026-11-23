'use client';

import { Button } from '@repo/ui/button';
import { Spinner } from '@repo/ui/spinner';
import { LogOutIcon } from 'lucide-react';
import { useLogout } from '@/hooks/use-logout';

/** The `/account` footer's Log out button: ends the session and goes to `/login`. */
export function LogoutButton() {
  const { logout, isBusy } = useLogout();
  return (
    <Button
      type="button"
      variant="outline"
      size="lg"
      className="h-11 gap-2.5 px-4 text-base font-semibold"
      disabled={isBusy}
      aria-busy={isBusy}
      onClick={logout}
    >
      {isBusy ? <Spinner aria-hidden /> : <LogOutIcon aria-hidden />}
      Log out
    </Button>
  );
}
