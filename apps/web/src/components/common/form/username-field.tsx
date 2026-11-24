'use client';

import { ApiError } from '@repo/lib/api/api-error';
import {
  USERNAME_MAX_LENGTH,
  USERNAME_RULE_TEXT,
} from '@repo/lib/auth/credential-rules';
import { AUTH_ERROR_CODE } from '@repo/lib/auth/error-codes';
import type { ModelRow } from '@repo/prisma';
import type { ComponentProps } from 'react';
import { useCheckUsername } from '@/hooks/use-check-username';
import { withCredentialFieldGroup } from './credential-form';

/** Debounce before calling `GET /auth/check-username` while the User types. */
const USERNAME_CHECK_DEBOUNCE_MS = 300;

const HTTP_TOO_MANY_REQUESTS = 429;

const AVAILABLE_MESSAGE = 'Available';
const USERNAME_TAKEN_MESSAGE = 'This username is taken';
const RATE_LIMITED_MESSAGE = 'Too many checks. Wait a minute, then try again.';
const CHECK_FAILED_MESSAGE = 'Could not check this username. Try again.';
const ALREADY_YOUR_USERNAME_MESSAGE = 'This is already your username';

/**
 * The shared username input for Credential setup and change username: Credential
 * rule text, live availability check via `useCheckUsername` (debounced 300 ms
 * through TanStack Form's `onChangeAsync`, cached 30 s, aborted on new input),
 * an unannounced spinner while checking, and one polite live region announcing
 * the result. When `currentUsername` is given, typing it shows "This is already
 * your username" and sends no check.
 */
export const UsernameField = withCredentialFieldGroup({
  defaultValues: { username: '' },
  props: {} as {
    /** The visible label ("Username", "New username"). */
    label: string;
    /** On change username, the User's current username so re-typing it sends no check. */
    currentUsername?: ModelRow<'User'>['username'];
    /** Extra width classes for the input wrapper (e.g. `md:max-w-90`). */
    inputClassName?: string;
    enterKeyHint?: ComponentProps<'input'>['enterKeyHint'];
  },
  render: function RenderUsernameField({
    group,
    label,
    currentUsername,
    inputClassName,
    enterKeyHint,
  }) {
    const { checkUsername, isFetching } = useCheckUsername();

    return (
      <group.AppField
        name="username"
        validators={{
          // Field-level sync check: stops the async check when the User types
          // their current username and clears any previous async error on edit.
          onChange: ({ value }) =>
            currentUsername && value === currentUsername
              ? ALREADY_YOUR_USERNAME_MESSAGE
              : undefined,
          onChangeAsyncDebounceMs: USERNAME_CHECK_DEBOUNCE_MS,
          onChangeAsync: async ({ value, signal }) => {
            try {
              await checkUsername(value, signal);
              return undefined;
            } catch (error) {
              if (signal.aborted) return undefined;
              return getCheckErrorMessage(error);
            }
          },
        }}
      >
        {(field) => {
          const { isDirty, isValid, isValidating } = field.state.meta;
          const isChecking = isFetching && isValid;
          const isAvailable =
            isDirty && isValid && !isValidating && !isFetching;
          const liveAnnouncement = getLiveAnnouncement(
            field.state.meta,
            isAvailable,
          );

          return (
            <>
              <field.CredentialField
                label={label}
                description={USERNAME_RULE_TEXT}
                inputClassName="pr-9 font-mono"
                inputWrapperClassName={inputClassName}
                isChecking={isChecking}
                statusMessage={isAvailable ? AVAILABLE_MESSAGE : undefined}
                reserveMessageSpace
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint={enterKeyHint}
                maxLength={USERNAME_MAX_LENGTH}
              />
              {/* One polite live region always on the page, announcing the check result. */}
              <div aria-live="polite" className="sr-only">
                {liveAnnouncement}
              </div>
            </>
          );
        }}
      </group.AppField>
    );
  },
});

/** Maps a failed username availability check error to the inline message. */
function getCheckErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return CHECK_FAILED_MESSAGE;
  if (error.code === AUTH_ERROR_CODE.USERNAME_TAKEN) {
    return USERNAME_TAKEN_MESSAGE;
  }
  if (
    error.code === AUTH_ERROR_CODE.TOO_MANY_ATTEMPTS ||
    error.status === HTTP_TOO_MANY_REQUESTS
  ) {
    return RATE_LIMITED_MESSAGE;
  }
  return CHECK_FAILED_MESSAGE;
}

/**
 * Text for the username field's polite live region: announces "Available",
 * taken, failure messages, or "This is already your username"; silent while
 * checking or while typing a Credential-rule violation.
 */
function getLiveAnnouncement(
  meta: {
    isValidating: boolean;
    errorMap: { onChange?: unknown };
    errorSourceMap: { onChange?: 'form' | 'field' };
  },
  isAvailable: boolean,
): string {
  if (meta.isValidating) return '';
  if (isAvailable) return AVAILABLE_MESSAGE;
  if (
    meta.errorSourceMap.onChange === 'field' &&
    typeof meta.errorMap.onChange === 'string'
  ) {
    return meta.errorMap.onChange;
  }
  return '';
}
