'use client';

import { AUTH_ERROR_CODE } from '@repo/lib/auth/error-codes';
import { getErrorMessage } from '@repo/lib/auth/error-messages';
import {
  PASSWORD_RULE_TEXT,
  getConfirmPasswordError,
  getPasswordError,
} from '@repo/lib/auth/credential-rules';
import { Alert, AlertDescription } from '@repo/ui/alert';
import { Button } from '@repo/ui/button';
import { Card, CardContent } from '@repo/ui/card';
import { Field, FieldDescription, FieldLabel } from '@repo/ui/field';
import { Input } from '@repo/ui/input';
import { Spinner } from '@repo/ui/spinner';
import { useForm, useSelector } from '@tanstack/react-form';
import {
  ArrowRightIcon,
  CheckIcon,
  CircleAlertIcon,
  ClockIcon,
} from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { CredentialFieldError } from '@/components/common/credential-field-error';
import { GoogleIcon } from '@/components/login/google-icon';
import { useGoogleLogin } from '@/hooks/use-google-login';
import { useResetPassword } from '@/hooks/use-reset-password';
import { getDescribedBy, isShowingErrors } from '@/lib/field-errors';

/**
 * The `/account/reset-password` card (Password reset): a new password with the
 * Credential rules under it, and its confirmation, one error per field. After success it says the password changed. When the API
 * answers `RECENT_GOOGLE_SIGN_IN_REQUIRED` (the 10 minutes after the Google
 * sign-in have passed) it offers signing in with Google again, which comes
 * back here.
 */
export function ResetPasswordCard() {
  const { resetPassword, isPending, isSuccess, isError, error } =
    useResetPassword();
  const { startGoogleLogin, isBusy: isGoogleBusy } = useGoogleLogin();

  const form = useForm({
    defaultValues: { newPassword: '', confirmPassword: '' },
    validators: {
      onChange: ({ value }) => ({
        fields: {
          newPassword: getPasswordError(value.newPassword),
          confirmPassword: getConfirmPasswordError(
            value.confirmPassword,
            value.newPassword,
          ),
        },
      }),
    },
    onSubmit: ({ value }) => resetPassword(value.newPassword),
  });
  const hasTriedSubmit = useSelector(
    form.store,
    (state) => state.submissionAttempts > 0,
  );

  if (isSuccess) {
    return (
      <ResetCardShell>
        <StatusIcon className="bg-success/10 text-success">
          <CheckIcon strokeWidth={2.5} />
        </StatusIcon>
        <CardHeading
          title="Password changed"
          description="Use it with your username next time you sign in on a lab computer."
        />
        <Button
          variant="outline"
          size="lg"
          className="bg-card h-12 w-full gap-2 text-base font-bold"
          render={<Link href="/" />}
          nativeButton={false}
        >
          Continue to NextGen Grader
          <ArrowRightIcon aria-hidden />
        </Button>
      </ResetCardShell>
    );
  }

  if (error === AUTH_ERROR_CODE.RECENT_GOOGLE_SIGN_IN_REQUIRED) {
    return (
      <ResetCardShell>
        <StatusIcon className="bg-warning/10 text-warning">
          <ClockIcon strokeWidth={2.25} />
        </StatusIcon>
        <CardHeading
          title="This reset link has expired"
          description={getErrorMessage(error)}
        />
        <Button
          size="lg"
          className="h-auto min-h-13 w-full gap-3 py-2.5 text-left text-base leading-5 font-bold whitespace-normal disabled:aria-busy:opacity-100"
          disabled={isGoogleBusy}
          aria-busy={isGoogleBusy}
          onClick={() => startGoogleLogin(RESET_PASSWORD_PATH)}
        >
          {isGoogleBusy ? (
            <Spinner aria-hidden className="size-4.5" />
          ) : (
            <GoogleIcon className="size-6.5 shrink-0 rounded-md bg-white p-1.25" />
          )}
          {isGoogleBusy
            ? 'Opening university sign-in…'
            : 'Sign in with your university account again'}
        </Button>
      </ResetCardShell>
    );
  }

  return (
    <ResetCardShell>
      <CardHeading
        title="Choose a new password"
        description="You signed in with your university account, so you can set a new password without the old one."
        isFocusedOnShow={false}
      />
      <form
        aria-labelledby="reset-password-title"
        onSubmit={(event) => {
          event.preventDefault();
          void form.handleSubmit();
        }}
      >
        {/* A polite live region always on the page, so a new message in it is announced. */}
        <div aria-live="polite" className="not-empty:mb-5">
          {isError && (
            <Alert
              role={undefined}
              variant="destructive"
              className="bg-destructive/10 border-0 px-3.5 py-3 font-semibold"
            >
              <CircleAlertIcon />
              <AlertDescription>{getErrorMessage(error)}</AlertDescription>
            </Alert>
          )}
        </div>

        <div className="flex flex-col gap-5">
          <form.Field name="newPassword">
            {(field) => {
              const isShowingFieldErrors = isShowingErrors(
                field.state.meta,
                hasTriedSubmit,
              );
              return (
                <Field className="gap-2" data-invalid={isShowingFieldErrors}>
                  <FieldLabel
                    htmlFor="reset-new-password"
                    className="font-semibold"
                  >
                    New password
                  </FieldLabel>
                  <Input
                    id="reset-new-password"
                    name={field.name}
                    type="password"
                    autoComplete="new-password"
                    aria-invalid={isShowingFieldErrors}
                    aria-describedby={getDescribedBy(
                      'reset-new-password',
                      isShowingFieldErrors,
                    )}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    className="h-11 px-3 text-base"
                  />
                  <FieldDescription id="reset-new-password-description">
                    {PASSWORD_RULE_TEXT}
                  </FieldDescription>
                  {isShowingFieldErrors && (
                    <CredentialFieldError id="reset-new-password-error">
                      {field.state.meta.errors.join(' ')}
                    </CredentialFieldError>
                  )}
                </Field>
              );
            }}
          </form.Field>

          <form.Field name="confirmPassword">
            {(field) => {
              const isShowingFieldErrors = isShowingErrors(
                field.state.meta,
                hasTriedSubmit,
              );
              return (
                <Field className="gap-2" data-invalid={isShowingFieldErrors}>
                  <FieldLabel
                    htmlFor="reset-confirm-password"
                    className="font-semibold"
                  >
                    Confirm new password
                  </FieldLabel>
                  <Input
                    id="reset-confirm-password"
                    name={field.name}
                    type="password"
                    autoComplete="new-password"
                    enterKeyHint="done"
                    aria-invalid={isShowingFieldErrors}
                    aria-describedby={
                      isShowingFieldErrors
                        ? 'reset-confirm-password-error'
                        : undefined
                    }
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    className="h-11 px-3 text-base"
                  />
                  {isShowingFieldErrors && (
                    <CredentialFieldError id="reset-confirm-password-error">
                      {field.state.meta.errors.join(' ')}
                    </CredentialFieldError>
                  )}
                </Field>
              );
            }}
          </form.Field>

          <form.Subscribe
            selector={(state) => state.isValid && !state.isPristine}
          >
            {(canSubmit) => (
              <Button
                type="submit"
                size="lg"
                className="h-auto min-h-12 w-full gap-2.5 text-base font-bold disabled:aria-busy:opacity-75"
                disabled={!canSubmit || isPending}
                aria-busy={isPending}
              >
                {isPending && <Spinner aria-hidden />}
                {isPending ? 'Saving…' : 'Save new password'}
              </Button>
            )}
          </form.Subscribe>
        </div>
      </form>
    </ResetCardShell>
  );
}

/** Where Google sign-in comes back to when the reset window has passed. */
const RESET_PASSWORD_PATH = '/account/reset-password';

/** The white card every state of the page sits in. */
function ResetCardShell({ children }: { children: ReactNode }) {
  return (
    <Card className="shadow-foreground/5 w-full max-w-105 rounded-xl shadow-lg ring-0 [--card-spacing:--spacing(5)] sm:[--card-spacing:--spacing(8)]">
      <CardContent className="flex flex-col gap-6">{children}</CardContent>
    </Card>
  );
}

/** The round tinted icon above the expired and success states. */
function StatusIcon({
  className,
  children,
}: {
  /** Background and icon color. */
  className: string;
  children: ReactNode;
}) {
  return (
    <span
      aria-hidden
      className={`flex size-11 items-center justify-center rounded-full [&_svg]:size-5 ${className}`}
    >
      {children}
    </span>
  );
}

/**
 * "Password reset" above the state's title and description. The expired and
 * success states replace the form, so their title takes focus to be read out.
 */
function CardHeading({
  title,
  description,
  isFocusedOnShow = true,
}: {
  title: string;
  description: string;
  /** Whether the title takes focus when it appears. */
  isFocusedOnShow?: boolean;
}) {
  return (
    <div className="-mt-1 flex flex-col gap-1.5">
      <p className="text-primary text-[13px] font-bold">Password reset</p>
      <h1
        id="reset-password-title"
        tabIndex={-1}
        ref={isFocusedOnShow ? (node) => node?.focus() : undefined}
        className="text-2xl font-extrabold tracking-tight focus:outline-none"
      >
        {title}
      </h1>
      <p className="text-muted-foreground text-base">{description}</p>
    </div>
  );
}
