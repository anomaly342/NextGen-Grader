'use client';

import { AUTH_ERROR_CODE } from '@repo/lib/auth/error-codes';
import { getErrorMessage } from '@repo/lib/auth/error-messages';
import {
  getConfirmPasswordError,
  getPasswordError,
} from '@repo/lib/auth/credential-rules';
import { Alert, AlertDescription } from '@repo/ui/alert';
import { Button } from '@repo/ui/button';
import { Spinner } from '@repo/ui/spinner';
import { CheckIcon, CircleAlertIcon } from 'lucide-react';
import {
  setSubmitError,
  useCredentialForm,
} from '@/components/common/form/credential-form';
import { NewPasswordFields } from '@/components/common/form/new-password-fields';
import { useChangePassword } from '@/hooks/use-change-password';

/**
 * The `/account` change-password form: current password, new password with
 * the Credential rules under it, and its confirmation, one error per field. A wrong current
 * password shows under that input and changes nothing. On success the form
 * clears and says so until the User types again; this session stays signed in.
 */
export function ChangePasswordForm({
  labelledBy,
}: {
  /** Id of the heading that names this form (the page has two). */
  labelledBy: string;
}) {
  const { changePassword, isPending, isSuccess, isError, error } =
    useChangePassword();

  const form = useCredentialForm({
    formId: 'change-password',
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
    validators: {
      onChange: ({ value }) => ({
        fields: {
          currentPassword: getCurrentPasswordError(value.currentPassword),
          newPassword: getPasswordError(value.newPassword),
          confirmPassword: getConfirmPasswordError(
            value.confirmPassword,
            value.newPassword,
          ),
        },
      }),
    },
    onSubmit: ({ value }) =>
      changePassword(
        {
          currentPassword: value.currentPassword,
          newPassword: value.newPassword,
        },
        {
          onSuccess: () => form.reset(),
          onError: (error) => {
            if (error.code !== AUTH_ERROR_CODE.INVALID_CREDENTIALS) return;
            setSubmitError(
              form,
              'currentPassword',
              WRONG_CURRENT_PASSWORD_MESSAGE,
            );
          },
        },
      ),
  });

  const hasFormError = isError && error !== AUTH_ERROR_CODE.INVALID_CREDENTIALS;

  return (
    <form
      aria-labelledby={labelledBy}
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

      <div className="flex flex-col gap-5">
        <form.AppField name="currentPassword">
          {(field) => (
            <field.CredentialField
              label="Current password"
              inputClassName="md:max-w-90"
              type="password"
              autoComplete="current-password"
            />
          )}
        </form.AppField>
        <NewPasswordFields
          form={form}
          fields={{
            password: 'newPassword',
            confirmPassword: 'confirmPassword',
          }}
          inputClassName="md:max-w-90"
        />

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <form.Subscribe
            selector={(state) => state.isValid && !state.isPristine}
          >
            {(canSubmit) => (
              <Button
                type="submit"
                size="lg"
                className="h-11 gap-2.5 px-4.5 text-base font-bold disabled:aria-busy:opacity-75"
                disabled={!canSubmit || isPending}
                aria-busy={isPending}
              >
                {isPending && <Spinner aria-hidden />}
                {isPending ? 'Changing password…' : 'Change password'}
              </Button>
            )}
          </form.Subscribe>
          <p role="status">
            {isSuccess && (
              <form.Subscribe selector={(state) => state.isPristine}>
                {(isPristine) =>
                  isPristine && (
                    <span className="text-success flex items-center gap-1.5 text-sm font-bold">
                      <CheckIcon
                        aria-hidden
                        strokeWidth={2.5}
                        className="size-4"
                      />
                      Password changed.
                    </span>
                  )
                }
              </form.Subscribe>
            )}
          </p>
        </div>
      </div>
    </form>
  );
}

/** Shown under the current password for `INVALID_CREDENTIALS`; the shared map's text speaks of a username. */
const WRONG_CURRENT_PASSWORD_MESSAGE = 'Current password is wrong.';

/**
 * The current password's error while it is empty. Not a Credential rule: it
 * proves who the User is, so it stays with this form.
 */
function getCurrentPasswordError(currentPassword: string): string | undefined {
  if (currentPassword === '') return 'Enter your current password.';
  return undefined;
}
