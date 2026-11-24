'use client';

import { AUTH_ERROR_CODE } from '@repo/lib/auth/error-codes';
import { getErrorMessage } from '@repo/lib/auth/error-messages';
import {
  PASSWORD_RULE_TEXT,
  getConfirmPasswordError,
  getPasswordError,
  getUsernameError,
} from '@repo/lib/auth/credential-rules';
import { getInitials } from '@repo/lib/user/initials';
import type { ModelRow } from '@repo/prisma';
import { Alert, AlertDescription } from '@repo/ui/alert';
import { Avatar, AvatarFallback } from '@repo/ui/avatar';
import { Button } from '@repo/ui/button';
import { Card, CardContent } from '@repo/ui/card';
import { FieldGroup } from '@repo/ui/field';
import { Separator } from '@repo/ui/separator';
import { Spinner } from '@repo/ui/spinner';
import { CircleAlertIcon } from 'lucide-react';
import {
  setSubmitError,
  useCredentialForm,
} from '@/components/common/form/credential-form';
import { UsernameField } from '@/components/common/form/username-field';
import { useCheckUsername } from '@/hooks/use-check-username';
import { useFinishSetup } from '@/hooks/use-finish-setup';
import { useLogout } from '@/hooks/use-logout';

/**
 * The `/setup` card (Credential setup): the signed-in University account with
 * "Not you? Log out", then username, password and confirm password. Each
 * field's validator returns its error text and the field shows it under the
 * input. Success goes to `next` or `/`.
 */
export function SetupCard({
  user,
  next,
}: {
  /** The signed-in University account, shown read-only. */
  user: Pick<ModelRow<'User'>, 'name' | 'email'>;
  /** Same-site path to land on after setup, already checked. */
  next: string | null;
}) {
  const { logout, isBusy: isLoggingOut } = useLogout();
  const { finishSetup, isBusy, isError, error } = useFinishSetup(next);
  const { isFetching } = useCheckUsername();

  const form = useCredentialForm({
    formId: 'setup',
    defaultValues: { username: '', password: '', confirmPassword: '' },
    validators: {
      // Form-level, so every change checks every field: canSubmit then covers
      // fields the User has not typed in yet, not only the one that changed.
      onChange: ({ value }) => ({
        fields: {
          username: getUsernameError(value.username),
          password: getPasswordError(value.password),
          confirmPassword: getConfirmPasswordError(
            value.confirmPassword,
            value.password,
          ),
        },
      }),
    },
    onSubmit: ({ value }) =>
      finishSetup(
        { username: value.username, password: value.password },
        {
          onError: (error) => {
            if (error.code !== AUTH_ERROR_CODE.USERNAME_TAKEN) return;
            setSubmitError(form, 'username', getErrorMessage(error.code));
          },
        },
      ),
  });

  const hasFormError = isError && error !== AUTH_ERROR_CODE.USERNAME_TAKEN;

  return (
    <Card className="shadow-foreground/5 w-full max-w-110 gap-6 rounded-xl shadow-lg ring-0 [--card-spacing:--spacing(5)] sm:[--card-spacing:--spacing(8)]">
      <CardContent className="flex flex-col gap-6">
        <div className="flex items-center gap-3.5">
          <Avatar className="size-11 after:border-0">
            <AvatarFallback className="bg-primary/10 text-primary text-[15px] font-extrabold">
              {getInitials(user.name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-col gap-0.5">
            <p className="text-[15px] leading-5 font-bold">{user.name}</p>
            <p className="text-muted-foreground text-sm wrap-anywhere">
              {user.email}
            </p>
            <p className="text-muted-foreground text-[13px] leading-4.5">
              Not you?{' '}
              <Button
                type="button"
                variant="link"
                className="-my-3 h-11 px-0 text-[13px] font-bold"
                disabled={isBusy || isLoggingOut}
                aria-busy={isLoggingOut}
                onClick={logout}
              >
                Log out
              </Button>
            </p>
          </div>
        </div>

        <Separator />

        <div className="flex flex-col gap-1.5">
          <h1 className="text-2xl font-extrabold tracking-tight">
            Set up your sign-in
          </h1>
          <p className="text-muted-foreground text-base">
            A username and password let you sign in on lab computers without
            Google. You only do this once.
          </p>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit();
          }}
        >
          {/* A polite live region always on the page, so a new message in it is announced. */}
          <div aria-live="polite" className="not-empty:mb-5">
            {hasFormError && (
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

          <FieldGroup className="gap-5">
            <UsernameField
              form={form}
              fields={{ username: 'username' }}
              label="Username"
            />
            <form.AppField name="password">
              {(field) => (
                <field.CredentialField
                  label="Password"
                  description={PASSWORD_RULE_TEXT}
                  type="password"
                  autoComplete="new-password"
                />
              )}
            </form.AppField>
            <form.AppField name="confirmPassword">
              {(field) => (
                <field.CredentialField
                  label="Confirm password"
                  type="password"
                  autoComplete="new-password"
                  enterKeyHint="done"
                />
              )}
            </form.AppField>

            <form.Subscribe
              selector={(state) =>
                state.isValid && !state.isPristine && !state.isFieldsValidating
              }
            >
              {(canSubmit) => (
                <Button
                  type="submit"
                  size="lg"
                  className="h-auto min-h-12 w-full gap-2.5 text-base font-bold disabled:aria-busy:opacity-75"
                  disabled={!canSubmit || isBusy || isLoggingOut || isFetching}
                  aria-busy={isBusy}
                >
                  {isBusy && <Spinner aria-hidden />}
                  {isBusy ? 'Finishing setup…' : 'Finish setup'}
                </Button>
              )}
            </form.Subscribe>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
