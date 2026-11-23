'use client';

import { AUTH_ERROR_CODE } from '@repo/lib/auth/error-codes';
import { getErrorMessage } from '@repo/lib/auth/error-messages';
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  checkPassword,
  checkUsername,
  type PasswordIssue,
  type UsernameIssue,
} from '@repo/lib/auth/credential-rules';
import { getInitials } from '@repo/lib/user/initials';
import type { ModelRow } from '@repo/prisma';
import { Alert, AlertDescription } from '@repo/ui/alert';
import { Avatar, AvatarFallback } from '@repo/ui/avatar';
import { Button } from '@repo/ui/button';
import { Card, CardContent } from '@repo/ui/card';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@repo/ui/field';
import { Input } from '@repo/ui/input';
import { Separator } from '@repo/ui/separator';
import { Spinner } from '@repo/ui/spinner';
import { useForm, useSelector } from '@tanstack/react-form';
import { CircleAlertIcon } from 'lucide-react';
import { useRef } from 'react';
import { useFinishSetup } from '@/hooks/use-finish-setup';
import { useLogout } from '@/hooks/use-logout';
import { isShowingErrors } from '@/lib/field-errors';

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
  const usernameInput = useRef<HTMLInputElement>(null);

  const { logout, isBusy: isLoggingOut } = useLogout();
  const { finishSetup, isBusy, isError, error } = useFinishSetup(next);

  const form = useForm({
    defaultValues: { username: '', password: '', confirmPassword: '' },
    validators: {
      // Form-level, so every change checks every field: canSubmit then covers
      // fields the User has not typed in yet, not only the one that changed.
      onChange: ({ value }) => {
        const usernameIssue = checkUsername(value.username);
        const passwordIssue = checkPassword(value.password);
        return {
          fields: {
            username: usernameIssue
              ? USERNAME_ISSUE_MESSAGES[usernameIssue]
              : undefined,
            password: passwordIssue
              ? PASSWORD_ISSUE_MESSAGES[passwordIssue]
              : undefined,
            // Checked here only: the API never sees the confirmation.
            confirmPassword: getConfirmPasswordError(
              value.confirmPassword,
              value.password,
            ),
          },
        };
      },
    },
    onSubmit: ({ value }) =>
      finishSetup(
        { username: value.username, password: value.password },
        {
          onError: (error) => {
            if (error.code !== AUTH_ERROR_CODE.USERNAME_TAKEN) return;
            // Shown with the field's own errors; the username's onChange listener clears it.
            form.setFieldMeta('username', (meta) => ({
              ...meta,
              errorMap: {
                ...meta.errorMap,
                onSubmit: getErrorMessage(error.code),
              },
            }));
            // Focus reads the field's error out, through aria-describedby.
            usernameInput.current?.focus();
          },
        },
      ),
  });
  const hasTriedSubmit = useSelector(
    form.store,
    (state) => state.submissionAttempts > 0,
  );

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
            <form.Field
              name="username"
              listeners={{
                // A new username drops the API's "taken" error for the old one.
                onChange: ({ fieldApi }) =>
                  fieldApi.setErrorMap({ onSubmit: undefined }),
              }}
            >
              {(field) => (
                <Field
                  className="gap-2"
                  data-invalid={isShowingErrors(
                    field.state.meta,
                    hasTriedSubmit,
                  )}
                >
                  <FieldLabel
                    htmlFor="setup-username"
                    className="font-semibold"
                  >
                    Username
                  </FieldLabel>
                  <Input
                    id="setup-username"
                    name={field.name}
                    autoComplete="username"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    maxLength={USERNAME_MAX_LENGTH}
                    ref={usernameInput}
                    aria-invalid={isShowingErrors(
                      field.state.meta,
                      hasTriedSubmit,
                    )}
                    aria-describedby={getDescribedBy(
                      'setup-username',
                      isShowingErrors(field.state.meta, hasTriedSubmit),
                    )}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    className="h-11 px-3 font-mono text-base"
                  />
                  <FieldDescription id="setup-username-description">
                    {USERNAME_MIN_LENGTH}–{USERNAME_MAX_LENGTH} characters:
                    lowercase a–z, digits 0–9 and _.
                  </FieldDescription>
                  {isShowingErrors(field.state.meta, hasTriedSubmit) && (
                    <FieldError id="setup-username-error" role={undefined}>
                      {field.state.meta.errors.join(' ')}
                    </FieldError>
                  )}
                </Field>
              )}
            </form.Field>

            <form.Field name="password">
              {(field) => (
                <Field
                  className="gap-2"
                  data-invalid={isShowingErrors(
                    field.state.meta,
                    hasTriedSubmit,
                  )}
                >
                  <FieldLabel
                    htmlFor="setup-password"
                    className="font-semibold"
                  >
                    Password
                  </FieldLabel>
                  <Input
                    id="setup-password"
                    name={field.name}
                    type="password"
                    autoComplete="new-password"
                    aria-invalid={isShowingErrors(
                      field.state.meta,
                      hasTriedSubmit,
                    )}
                    aria-describedby={getDescribedBy(
                      'setup-password',
                      isShowingErrors(field.state.meta, hasTriedSubmit),
                    )}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    className="h-11 px-3 text-base"
                  />
                  <FieldDescription id="setup-password-description">
                    {PASSWORD_MIN_LENGTH}–{PASSWORD_MAX_LENGTH} characters.
                  </FieldDescription>
                  {isShowingErrors(field.state.meta, hasTriedSubmit) && (
                    <FieldError id="setup-password-error" role={undefined}>
                      {field.state.meta.errors.join(' ')}
                    </FieldError>
                  )}
                </Field>
              )}
            </form.Field>

            <form.Field name="confirmPassword">
              {(field) => (
                <Field
                  className="gap-2"
                  data-invalid={isShowingErrors(
                    field.state.meta,
                    hasTriedSubmit,
                  )}
                >
                  <FieldLabel htmlFor="setup-confirm" className="font-semibold">
                    Confirm password
                  </FieldLabel>
                  <Input
                    id="setup-confirm"
                    name={field.name}
                    type="password"
                    autoComplete="new-password"
                    enterKeyHint="done"
                    aria-invalid={isShowingErrors(
                      field.state.meta,
                      hasTriedSubmit,
                    )}
                    aria-describedby={
                      isShowingErrors(field.state.meta, hasTriedSubmit)
                        ? 'setup-confirm-error'
                        : undefined
                    }
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    className="h-11 px-3 text-base"
                  />
                  {isShowingErrors(field.state.meta, hasTriedSubmit) && (
                    <FieldError id="setup-confirm-error" role={undefined}>
                      {field.state.meta.errors.join(' ')}
                    </FieldError>
                  )}
                </Field>
              )}
            </form.Field>

            <form.Subscribe
              selector={(state) => state.isValid && !state.isPristine}
            >
              {(canSubmit) => (
                <Button
                  type="submit"
                  size="lg"
                  className="h-auto min-h-12 w-full gap-2.5 text-base font-bold disabled:aria-busy:opacity-75"
                  disabled={!canSubmit || isBusy || isLoggingOut}
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

/** Error text for each username rule. */
const USERNAME_ISSUE_MESSAGES: Readonly<Record<UsernameIssue, string>> = {
  TOO_SHORT: `Use at least ${USERNAME_MIN_LENGTH} characters.`,
  TOO_LONG: `Use at most ${USERNAME_MAX_LENGTH} characters.`,
  INVALID_CHARACTERS: 'Use only lowercase a–z, digits 0–9 and _.',
};

/** Error text for each password rule. */
const PASSWORD_ISSUE_MESSAGES: Readonly<Record<PasswordIssue, string>> = {
  TOO_SHORT: `Use at least ${PASSWORD_MIN_LENGTH} characters.`,
  TOO_LONG: `Use at most ${PASSWORD_MAX_LENGTH} characters.`,
};

/** Error text for the confirmation: empty, or not the same as the password. */
function getConfirmPasswordError(
  confirmPassword: string,
  password: string,
): string | undefined {
  if (confirmPassword === '') return 'Type the password again.';
  return confirmPassword === password
    ? undefined
    : 'Does not match the password.';
}

/** `aria-describedby` for an input with a rules description: the error first when there is one. */
function getDescribedBy(inputId: string, hasError: boolean): string {
  return hasError
    ? `${inputId}-error ${inputId}-description`
    : `${inputId}-description`;
}
