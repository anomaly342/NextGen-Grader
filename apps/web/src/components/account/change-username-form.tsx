'use client';

import { AUTH_ERROR_CODE } from '@repo/lib/auth/error-codes';
import { getErrorMessage } from '@repo/lib/auth/error-messages';
import {
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  USERNAME_PATTERN,
  checkUsername,
} from '@repo/lib/auth/credential-rules';
import { Alert, AlertDescription } from '@repo/ui/alert';
import { Button } from '@repo/ui/button';
import { Field, FieldError, FieldLabel } from '@repo/ui/field';
import { Input } from '@repo/ui/input';
import { Spinner } from '@repo/ui/spinner';
import { useForm, useSelector } from '@tanstack/react-form';
import { CheckIcon, CircleAlertIcon } from 'lucide-react';
import { useRef } from 'react';
import { RuleChecklist } from '@/components/common/rule-checklist';
import { useChangeUsername } from '@/hooks/use-change-username';
import { isShowingErrors } from '@/lib/field-errors';

/**
 * The `/account` change-username form: a new username with its rules checked
 * as the User types, then "Change username". `USERNAME_TAKEN` shows under the
 * input. On success the page refreshes to show the new username and the form
 * says so until the User types again.
 */
export function ChangeUsernameForm({
  labelledBy,
}: {
  /** Id of the heading that names this form (the page has two). */
  labelledBy: string;
}) {
  const usernameInput = useRef<HTMLInputElement>(null);
  const { changeUsername, isPending, isSuccess, isError, error } =
    useChangeUsername();

  const form = useForm({
    defaultValues: { username: '' },
    validators: {
      // The rule checklist shows which rule fails; the value here only marks the field invalid.
      onChange: ({ value }) => ({
        fields: { username: checkUsername(value.username) ?? undefined },
      }),
    },
    onSubmit: ({ value }) =>
      changeUsername(value.username, {
        onSuccess: () => form.reset(),
        onError: (error) => {
          if (error.code !== AUTH_ERROR_CODE.USERNAME_TAKEN) return;
          // The username's onChange listener clears it.
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
      }),
  });
  const hasTriedSubmit = useSelector(
    form.store,
    (state) => state.submissionAttempts > 0,
  );

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
        <form.Field
          name="username"
          listeners={{
            // A new username drops the API's "taken" error for the old one.
            onChange: ({ fieldApi }) =>
              fieldApi.setErrorMap({ onSubmit: undefined }),
          }}
        >
          {(field) => {
            const isShowingFieldErrors = isShowingErrors(
              field.state.meta,
              hasTriedSubmit,
            );
            const takenError = field.state.meta.errorMap.onSubmit as
              string | undefined;
            return (
              <Field className="gap-2" data-invalid={isShowingFieldErrors}>
                <FieldLabel
                  htmlFor="account-username"
                  className="font-semibold"
                >
                  New username
                </FieldLabel>
                <Input
                  id="account-username"
                  name={field.name}
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  enterKeyHint="done"
                  maxLength={USERNAME_MAX_LENGTH}
                  ref={usernameInput}
                  aria-invalid={isShowingFieldErrors}
                  aria-describedby={
                    takenError
                      ? 'account-username-error account-username-rules'
                      : 'account-username-rules'
                  }
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  className="h-11 px-3 font-mono text-base md:max-w-90"
                />
                {takenError && (
                  <FieldError
                    id="account-username-error"
                    role={undefined}
                    className="flex items-center gap-2 text-[13px] font-semibold"
                  >
                    <CircleAlertIcon
                      aria-hidden
                      className="size-3.5 shrink-0"
                    />
                    {takenError}
                  </FieldError>
                )}
                <RuleChecklist
                  id="account-username-rules"
                  isShowingErrors={isShowingFieldErrors}
                  rules={[
                    {
                      label: `${USERNAME_MIN_LENGTH}–${USERNAME_MAX_LENGTH} characters`,
                      isMet: isUsernameLengthMet(field.state.value),
                    },
                    {
                      label: 'Lowercase a–z, digits 0–9 and _ only',
                      isMet: USERNAME_PATTERN.test(field.state.value),
                    },
                  ]}
                />
              </Field>
            );
          }}
        </form.Field>

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

/** Whether `username` is within the length rule (the characters rule is checked on its own). */
function isUsernameLengthMet(username: string): boolean {
  return (
    username.length >= USERNAME_MIN_LENGTH &&
    username.length <= USERNAME_MAX_LENGTH
  );
}
