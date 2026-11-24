import { getInitials } from '@repo/lib/user/initials';
import { Avatar, AvatarFallback } from '@repo/ui/avatar';
import { Card, CardContent } from '@repo/ui/card';
import { Separator } from '@repo/ui/separator';
import { LockIcon } from 'lucide-react';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { ChangePasswordForm } from '@/components/account/change-password-form';
import { ChangeUsernameForm } from '@/components/account/change-username-form';
import { LogoutButton } from '@/components/account/logout-button';
import { createServerClient } from '@/lib/server-client';

export const metadata: Metadata = { title: 'Account · NextGen Grader' };

/**
 * `/account`: the University account's Display name and email (read-only),
 * the change-username and change-password forms, and Log out. The forms call
 * `router.refresh()` after a change, which loads the User here again.
 */
export default async function AccountPage() {
  const cookie = (await headers()).get('cookie');
  const user = await createServerClient(cookie).getMe();
  if (!user) redirect('/login?next=/account');

  return (
    <main className="bg-background flex flex-1 justify-center px-4 pt-8 pb-12 md:pt-13">
      <div className="flex w-full max-w-172 flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-[28px] leading-9 font-extrabold tracking-tight md:text-[30px]">
            Account
          </h1>
          <p className="text-muted-foreground text-base">
            Your profile and how you sign in.
          </p>
        </div>

        <AccountSection
          titleId="account-profile-title"
          title="Profile"
          action={<ReadOnlyBadge />}
        >
          <div className="flex items-start gap-5">
            <Avatar className="size-13 after:border-0">
              <AvatarFallback className="bg-primary/10 text-primary text-lg font-extrabold">
                {getInitials(user.name)}
              </AvatarFallback>
            </Avatar>
            <dl className="flex min-w-0 flex-col gap-3">
              <div className="flex flex-col gap-0.5">
                <dt className="text-muted-foreground text-[13px] font-semibold">
                  Display name
                </dt>
                <dd className="text-base font-bold">{user.name}</dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="text-muted-foreground text-[13px] font-semibold">
                  University email
                </dt>
                <dd className="text-base font-semibold wrap-anywhere">
                  {user.email}
                </dd>
              </div>
            </dl>
          </div>
          <p className="text-muted-foreground text-sm">
            These come from your university account and can’t be changed here.
          </p>
        </AccountSection>

        <AccountSection
          titleId="account-username-title"
          title="Username"
          description="Use it with your password on lab computers."
        >
          <div className="flex flex-col gap-0.5">
            <p className="text-muted-foreground text-[13px] font-semibold">
              Current username
            </p>
            <p className="font-mono text-base font-semibold">{user.username}</p>
          </div>
          <Separator />
          <ChangeUsernameForm labelledBy="account-username-title" />
        </AccountSection>

        <AccountSection
          titleId="account-password-title"
          title="Password"
          description="Forgot it? Use “Forgot password?” on the sign-in page to reset it with your university account."
        >
          <ChangePasswordForm labelledBy="account-password-title" />
        </AccountSection>

        <div className="flex flex-col items-start gap-3 md:flex-row md:items-center md:justify-between">
          <p className="text-muted-foreground text-sm">
            On a shared lab computer, log out when you finish.
          </p>
          <LogoutButton />
        </div>
      </div>
    </main>
  );
}

/** One white card on `/account`: its heading row (and description), then `children`. */
function AccountSection({
  titleId,
  title,
  description,
  action,
  children,
}: {
  /** The heading's id, which names the card's form. */
  titleId: string;
  title: string;
  description?: string;
  /** Shown at the end of the heading row. */
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card className="shadow-foreground/5 gap-6 rounded-xl shadow-md ring-0 [--card-spacing:--spacing(5)] md:[--card-spacing:--spacing(7)]">
      <CardContent className="flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-4">
            <h2 id={titleId} className="text-lg font-extrabold tracking-tight">
              {title}
            </h2>
            {action}
          </div>
          {description && (
            <p className="text-muted-foreground text-sm">{description}</p>
          )}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

/** "Read-only" with a lock, beside the Profile heading. */
function ReadOnlyBadge() {
  return (
    <span className="text-muted-foreground flex items-center gap-1.5 text-[13px] font-semibold">
      <LockIcon aria-hidden className="size-3.5" />
      Read-only
    </span>
  );
}
