'use client';

import { AUTH_ERROR_CODE } from '@repo/lib/auth/error-codes';
import { ApiError } from '@repo/lib/api/api-error';
import { getErrorMessage } from '@repo/lib/auth/error-messages';
import { Alert, AlertDescription } from '@repo/ui/alert';
import { Button } from '@repo/ui/button';
import { Card, CardContent, CardHeader } from '@repo/ui/card';
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from '@repo/ui/field';
import { Input } from '@repo/ui/input';
import { Spinner } from '@repo/ui/spinner';
import { useForm } from '@tanstack/react-form';
import { CircleAlertIcon, ClockIcon } from 'lucide-react';
import { useRef } from 'react';
import { useCountdown } from '@/hooks/use-countdown';
import { useGoogleLogin } from '@/hooks/use-google-login';
import { useLogin } from '@/hooks/use-login';
import { GoogleIcon } from './google-icon';

/**
 * The `/login` card. Google (University account) is the primary way in and
 * returns to `next`; the username + password form is for shared lab computers.
 */
export function LoginCard({
  next,
  errorCode,
}: {
  /** Same-site path to land on after sign-in, already checked. */
  next: string | null;
  /** `?error=` from the Google callback. */
  errorCode: string | null;
}) {
  const passwordInput = useRef<HTMLInputElement>(null);
  const { secondsLeft, startCountdown } = useCountdown();

  const { startGoogleLogin, isBusy: isGoogleBusy } = useGoogleLogin();
  const { loginAsync, isBusy: isFormBusy, error: loginError } = useLogin(next);

  const form = useForm({
    defaultValues: { username: '', password: '' },
    onSubmit: ({ value }) =>
      loginAsync(value, {
        onError: (error) => {
          form.setFieldValue('password', '');
          // Focus reads the field's error out, through aria-describedby.
          if (error.code === AUTH_ERROR_CODE.INVALID_CREDENTIALS) {
            passwordInput.current?.focus();
          }
          const retryAfterSec = getRetryAfterSec(error);
          if (retryAfterSec !== null) startCountdown(retryAfterSec);
        },
      }),
  });

  const isBusy = isGoogleBusy || isFormBusy;
  const isLockedOut = secondsLeft > 0;

  const formErrorCode = getErrorCode(loginError);
  const isWrongPassword = formErrorCode === AUTH_ERROR_CODE.INVALID_CREDENTIALS;
  const isRateLimited = formErrorCode === AUTH_ERROR_CODE.TOO_MANY_ATTEMPTS;
  // Without `retryAfterSec` the message stays; with it, it goes when the countdown ends.
  const isShowingRateLimit =
    isRateLimited && (isLockedOut || getRetryAfterSec(loginError) === null);
  const hasOtherFormError =
    loginError !== null && !isWrongPassword && !isRateLimited;

  const bannerMessage = errorCode && getErrorMessage(errorCode);

  return (
    <Card className="shadow-foreground/5 w-full max-w-105 gap-5 rounded-xl shadow-lg ring-0 [--card-spacing:--spacing(6)] sm:[--card-spacing:--spacing(8)]">
      <CardHeader className="gap-1.5">
        <h1 className="text-2xl font-extrabold tracking-tight">Sign in</h1>
        <p className="text-muted-foreground text-base">
          For KMUTNB students and teachers.
        </p>
      </CardHeader>

      <CardContent className="flex flex-col gap-5">
        {bannerMessage && (
          <Alert
            variant="destructive"
            className="bg-destructive/10 border-0 px-3.5 py-3 font-semibold"
          >
            <CircleAlertIcon />
            <AlertDescription>{bannerMessage}</AlertDescription>
          </Alert>
        )}

        <Button
          size="lg"
          className="h-auto min-h-13 w-full gap-3 py-2.5 text-left text-base leading-5 font-bold whitespace-normal disabled:aria-busy:opacity-100"
          disabled={isBusy}
          aria-busy={isGoogleBusy}
          onClick={() => startGoogleLogin(next)}
        >
          {isGoogleBusy ? (
            <Spinner aria-hidden className="size-4.5" />
          ) : (
            <GoogleIcon className="size-6.5 rounded-md bg-white p-1.25" />
          )}
          {isGoogleBusy
            ? 'Opening university sign-in…'
            : 'Sign in with your university account'}
        </Button>

        <FieldSeparator className="*:data-[slot=field-separator-content]:bg-card my-0 font-semibold">
          or sign in with your username
        </FieldSeparator>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit();
          }}
        >
          <FieldGroup className="gap-4">
            <form.Field name="username">
              {(field) => (
                <Field>
                  <FieldLabel
                    htmlFor="login-username"
                    className="font-semibold"
                  >
                    Username
                  </FieldLabel>
                  <Input
                    id="login-username"
                    name={field.name}
                    autoComplete="username"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    required
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    className="h-11 px-3 font-mono text-base"
                  />
                </Field>
              )}
            </form.Field>

            <form.Field name="password">
              {(field) => (
                <Field>
                  <div className="flex items-center justify-between gap-3">
                    <FieldLabel
                      htmlFor="login-password"
                      className="font-semibold"
                    >
                      Password
                    </FieldLabel>
                    <Button
                      type="button"
                      variant="link"
                      className="-my-3 h-11 px-0 text-sm font-semibold"
                      disabled={isBusy}
                      onClick={() => startGoogleLogin(RESET_PASSWORD_PATH)}
                    >
                      Forgot password?
                    </Button>
                  </div>
                  <Input
                    id="login-password"
                    name={field.name}
                    type="password"
                    autoComplete="current-password"
                    enterKeyHint="done"
                    required
                    ref={passwordInput}
                    aria-invalid={isWrongPassword}
                    aria-describedby={
                      isWrongPassword ? FORM_MESSAGE_ID : undefined
                    }
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    className="h-11 px-3 text-base"
                  />
                </Field>
              )}
            </form.Field>

            {/* Always rendered, as in the design: the empty slot spaces Sign in from the fields. */}
            <div id={FORM_MESSAGE_ID}>
              {isWrongPassword && (
                // Not a live region: focus moves to the password, which reads this out.
                <FieldError
                  role={undefined}
                  className="flex items-center gap-2 font-semibold"
                >
                  <CircleAlertIcon aria-hidden className="size-4 shrink-0" />
                  {getErrorMessage(formErrorCode)}
                </FieldError>
              )}
              {/* One polite live region, always on the page, so new messages in it are announced. */}
              <div aria-live="polite">
                {isShowingRateLimit && (
                  <Alert
                    role={undefined}
                    className="bg-warning/10 text-warning border-0 px-3.5 py-3 font-semibold"
                  >
                    <ClockIcon />
                    <AlertDescription className="text-warning flex justify-between gap-3">
                      {getErrorMessage(formErrorCode)}
                      {isLockedOut && (
                        <time
                          dateTime={`PT${secondsLeft}S`}
                          aria-live="off"
                          className="tabular-nums"
                        >
                          {formatCountdown(secondsLeft)}
                        </time>
                      )}
                    </AlertDescription>
                  </Alert>
                )}
                {hasOtherFormError && (
                  <Alert
                    role={undefined}
                    variant="destructive"
                    className="bg-destructive/10 border-0 px-3.5 py-3 font-semibold"
                  >
                    <CircleAlertIcon />
                    <AlertDescription>
                      {getErrorMessage(formErrorCode)}
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </div>

            <Button
              type="submit"
              variant="outline"
              className="border-input bg-card disabled:border-secondary disabled:bg-secondary disabled:text-muted-foreground h-11 w-full text-base font-bold disabled:opacity-100"
              disabled={isBusy || isLockedOut}
              aria-busy={isFormBusy}
            >
              {isFormBusy && <Spinner aria-hidden />}
              {isFormBusy ? 'Signing in…' : 'Sign in'}
            </Button>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}

/** The slot for the form's messages; the password input points at it when the password was wrong. */
const FORM_MESSAGE_ID = 'login-form-message';

/** Where "Forgot password?" lands after the fresh Google sign-in. */
const RESET_PASSWORD_PATH = '/account/reset-password';

const SECONDS_PER_MINUTE = 60;

/** `retryAfterSec` from a 429 `TOO_MANY_ATTEMPTS` body, or null. */
function getRetryAfterSec(error: unknown): number | null {
  if (
    !(error instanceof ApiError) ||
    error.code !== AUTH_ERROR_CODE.TOO_MANY_ATTEMPTS
  ) {
    return null;
  }
  const retryAfterSec = error.body?.['retryAfterSec'];
  return typeof retryAfterSec === 'number' && retryAfterSec > 0
    ? Math.ceil(retryAfterSec)
    : null;
}

/** `m:ss`, e.g. 42 → `0:42`. */
function formatCountdown(seconds: number): string {
  const minutes = Math.floor(seconds / SECONDS_PER_MINUTE);
  const restSeconds = String(seconds % SECONDS_PER_MINUTE).padStart(2, '0');
  return `${minutes}:${restSeconds}`;
}
