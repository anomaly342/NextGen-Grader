'use client';

import { AUTH_ERROR_CODE } from '@repo/lib/auth/error-codes';
import { getErrorMessage } from '@repo/lib/auth/error-messages';
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  checkPassword,
  isPasswordConfirmed,
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
import { useChangePassword } from '@/hooks/use-change-password';
import { isShowingErrors } from '@/lib/field-errors';

/**
 * The `/account` change-password form: current password, new password and
 * its confirmation, with the rules checked as the User types. A wrong current
 * password shows under that input and changes nothing. On success the form
 * clears and says so until the User types again; this session stays signed in.
 */
export function ChangePasswordForm({
  labelledBy,
}: {
  /** Id of the heading that names this form (the page has two). */
  labelledBy: string;
}) {
  const currentPasswordInput = useRef<HTMLInputElement>(null);
  const { changePassword, isPending, isSuccess, isError, error } =
    useChangePassword();

  const form = useForm({
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
    validators: {
      // A field left out of `fields` has no error. New password and confirmation
      // show which rule fails in their checklists; their values here only mark
      // the fields invalid.
      onChange: ({ value }) => {
        const fields: Partial<Record<keyof typeof value, string>> = {};
        if (value.currentPassword === '') {
          fields.currentPassword = 'Enter your current password.';
        }
        const newPasswordIssue = checkPassword(value.newPassword);
        if (newPasswordIssue) {
          fields.newPassword = newPasswordIssue;
        }
        if (!isPasswordConfirmed(value.confirmPassword, value.newPassword)) {
          fields.confirmPassword = 'MISMATCH';
        }
        return { fields };
      },
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
            // The current password's onChange listener clears it.
            form.setFieldMeta('currentPassword', (meta) => ({
              ...meta,
              errorMap: {
                ...meta.errorMap,
                onSubmit: WRONG_CURRENT_PASSWORD_MESSAGE,
              },
            }));
            // Focus reads the field's error out, through aria-describedby.
            currentPasswordInput.current?.focus();
          },
        },
      ),
  });
  const hasTriedSubmit = useSelector(
    form.store,
    (state) => state.submissionAttempts > 0,
  );

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
        <form.Field
          name="currentPassword"
          listeners={{
            // A changed password drops the API's "wrong" error for the old one.
            onChange: ({ fieldApi }) =>
              fieldApi.setErrorMap({ onSubmit: undefined }),
          }}
        >
          {(field) => {
            const isShowingFieldErrors = isShowingErrors(
              field.state.meta,
              hasTriedSubmit,
            );
            return (
              <Field className="gap-2" data-invalid={isShowingFieldErrors}>
                <FieldLabel
                  htmlFor="account-current-password"
                  className="font-semibold"
                >
                  Current password
                </FieldLabel>
                <Input
                  id="account-current-password"
                  name={field.name}
                  type="password"
                  autoComplete="current-password"
                  ref={currentPasswordInput}
                  aria-invalid={isShowingFieldErrors}
                  aria-describedby={
                    isShowingFieldErrors
                      ? 'account-current-password-error'
                      : undefined
                  }
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  className="h-11 px-3 text-base md:max-w-90"
                />
                {isShowingFieldErrors && (
                  <FieldError
                    id="account-current-password-error"
                    role={undefined}
                    className="flex items-center gap-2 text-[13px] font-semibold"
                  >
                    <CircleAlertIcon
                      aria-hidden
                      className="size-3.5 shrink-0"
                    />
                    {field.state.meta.errors.join(' ')}
                  </FieldError>
                )}
              </Field>
            );
          }}
        </form.Field>

        <form.Field name="newPassword">
          {(field) => {
            const isShowingFieldErrors = isShowingErrors(
              field.state.meta,
              hasTriedSubmit,
            );
            return (
              <Field className="gap-2" data-invalid={isShowingFieldErrors}>
                <FieldLabel
                  htmlFor="account-new-password"
                  className="font-semibold"
                >
                  New password
                </FieldLabel>
                <Input
                  id="account-new-password"
                  name={field.name}
                  type="password"
                  autoComplete="new-password"
                  aria-invalid={isShowingFieldErrors}
                  aria-describedby="account-new-password-rules"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  className="h-11 px-3 text-base md:max-w-90"
                />
                <RuleChecklist
                  id="account-new-password-rules"
                  isShowingErrors={isShowingFieldErrors}
                  rules={[
                    {
                      label: `${PASSWORD_MIN_LENGTH}–${PASSWORD_MAX_LENGTH} characters`,
                      isMet: checkPassword(field.state.value) === null,
                    },
                  ]}
                />
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
                  htmlFor="account-confirm-password"
                  className="font-semibold"
                >
                  Confirm new password
                </FieldLabel>
                <Input
                  id="account-confirm-password"
                  name={field.name}
                  type="password"
                  autoComplete="new-password"
                  enterKeyHint="done"
                  aria-invalid={isShowingFieldErrors}
                  aria-describedby="account-confirm-password-rules"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  className="h-11 px-3 text-base md:max-w-90"
                />
                <form.Subscribe selector={(state) => state.values.newPassword}>
                  {(newPassword) => (
                    <RuleChecklist
                      id="account-confirm-password-rules"
                      isShowingErrors={isShowingFieldErrors}
                      rules={[
                        {
                          label: 'Matches the new password',
                          isMet: isPasswordConfirmed(
                            field.state.value,
                            newPassword,
                          ),
                        },
                      ]}
                    />
                  )}
                </form.Subscribe>
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
