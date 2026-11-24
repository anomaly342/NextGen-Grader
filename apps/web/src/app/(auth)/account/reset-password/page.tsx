import type { Metadata } from 'next';
import { BrandLockup } from '@/components/common/brand-lockup';
import { ResetPasswordCard } from '@/components/reset-password/reset-password-card';

export const metadata: Metadata = {
  title: 'Choose a new password · NextGen Grader',
};

/**
 * `/account/reset-password` (Password reset): reached through "Forgot
 * password?" on `/login`, which signs in with Google first. The proxy only lets
 * a signed-in User with Credential setup done through; the API decides whether
 * the 10-minute window is still open.
 */
export default function ResetPasswordPage() {
  return (
    <main className="bg-background flex flex-1 flex-col items-center gap-7 px-4 pt-[clamp(28px,9vh,80px)] pb-10">
      <BrandLockup />
      <ResetPasswordCard />
    </main>
  );
}
