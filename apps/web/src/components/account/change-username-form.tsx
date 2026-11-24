'use client';

import { AUTH_ERROR_CODE } from '@repo/lib/auth/error-codes';
import { getErrorMessage } from '@repo/lib/auth/error-messages';
import {
  USERNAME_MAX_LENGTH,
  USERNAME_RULE_TEXT,
  getUsernameError,
} from '@repo/lib/auth/credential-rules';
import { Alert, AlertDescription } from '@repo/ui/alert';
import { Button } from '@repo/ui/button';
import { Spinner } from '@repo/ui/spinner';
import { CheckIcon, CircleAlertIcon } from 'lucide-react';
import {
  setSubmitError,
  useCredentialForm,
} from '@/components/common/form/credential-form';
import { useChangeUsername } from '@/hooks/use-change-username';

/**
 * The `/account` change-username form: a new username with the Credential
 * rules under it and one error at a time, then "Change username".
 * `USERNAME_TAKEN` shows under the input. On success the page refreshes to show the new username and the form
 * says so until the User types again.
 */
export function ChangeUsernameForm({
  labelledBy,
}: {
  /** Id of the heading that names this form (the page has two). */
  labelledBy: string;
}) {
  const { changeUsername, isPending, isSuccess, isError, error } =
    useChangeUsername();

  const form = useCredentialForm({
    formId: 'change-username',
    defaultValues: { username: '' },
    validators: {
      onChange: ({ value }) => ({
        fields: { username: getUsernameError(value.username) },
      }),
    },
    onSubmit: ({ value }) =>
      changeUsername(value.username, {
        onSuccess: () => form.reset(),
        onError: (error) => {
          if (error.code !== AUTH_ERROR_CODE.USERNAME_TAKEN) return;
          setSubmitError(form, 'username', getErrorMessage(error.code));
        },
      }),
  });

  const hasFormError = isError && error !== AUTH_ERROR_CODE.USERNAME_TAKEN;

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
        <form.AppField name="username">
          {(field) => (
            <field.CredentialField
              label="New username"
              description={USERNAME_RULE_TEXT}
              inputClassName="font-mono md:max-w-90"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="done"
              maxLength={USERNAME_MAX_LENGTH}
            />
          )}
        </form.AppField>

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
                {isPending ? 'Changing username…' : 'Change username'}
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
                      Username changed.
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
