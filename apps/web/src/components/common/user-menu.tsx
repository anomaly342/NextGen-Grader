'use client';

import { getInitials } from '@repo/lib/user/initials';
import type { ModelRow } from '@repo/prisma';
import { Avatar, AvatarFallback } from '@repo/ui/avatar';
import { Button } from '@repo/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@repo/ui/dropdown-menu';
import { ChevronDownIcon, LogOutIcon, UserRoundIcon } from 'lucide-react';
import Link from 'next/link';
import { useLogout } from '@/hooks/use-logout';

/** The header's account menu: who is signed in, a link to `/account`, and Log out. */
export function UserMenu({
  user,
}: {
  user: Pick<ModelRow<'User'>, 'name' | 'email'>;
}) {
  const { logout, isBusy: isLoggingOut } = useLogout();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            aria-label={`Account menu, ${user.name}`}
            className="h-11 min-w-11 gap-2.5 rounded-full p-1.25 md:pr-3"
          />
        }
      >
        <Avatar className="size-8.5 after:border-0">
          <AvatarFallback className="bg-primary/10 text-primary text-xs font-extrabold">
            {getInitials(user.name)}
          </AvatarFallback>
        </Avatar>
        <span className="hidden text-sm font-bold md:inline">{user.name}</span>
        <ChevronDownIcon
          aria-hidden
          className="text-muted-foreground hidden md:block"
        />
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="shadow-foreground/10 w-70 max-w-[calc(100vw-24px)] rounded-xl p-1.5 shadow-xl ring-0"
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-foreground flex flex-col gap-0.5 px-3 pt-2.5 pb-3 text-sm">
            <strong className="text-base font-bold">{user.name}</strong>
            <span className="text-muted-foreground break-all">
              {user.email}
            </span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator className="mx-1.5 mt-0 mb-1.5" />
        <DropdownMenuItem
          render={<Link href="/account" />}
          className="min-h-11 gap-2.5 px-3 text-base font-semibold"
        >
          <UserRoundIcon className="text-muted-foreground" />
          Account
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={isLoggingOut}
          onClick={logout}
          className="min-h-11 gap-2.5 px-3 text-base font-semibold"
        >
          <LogOutIcon className="text-muted-foreground" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
