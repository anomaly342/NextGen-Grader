'use client';

import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from '@repo/ui/field';
import { Input } from '@repo/ui/input';
import { cn } from '@repo/ui/lib/utils';
import { Spinner } from '@repo/ui/spinner';
import { useSelector } from '@tanstack/react-form';
import { CheckIcon, CircleAlertIcon } from 'lucide-react';
import { useEffect, useRef, type ComponentProps, type ReactNode } from 'react';
import { useFieldContext } from '@/contexts/form-context';

/**
 * A labelled input for the field in context, with optional rule text under it,
 * an optional live-check spinner and positive status, and one error. The form
 * passes what makes it a username, new password, confirmation or current
 * password (`type`, `autoComplete`, rule text). Its id is the form's `formId`
 * plus the field name. It owns when the error shows, the invalid mark and
 * description link, clearing a submit error when the User types, and taking
 * focus when one arrives.
 */
export function CredentialField({
  label,
  description,
  inputClassName,
  inputWrapperClassName,
  isChecking,
  statusMessage,
  reserveMessageSpace,
  ...inputProps
}: {
  /** The visible label ("Username", "New password"). */
  label: string;
  /** Rule text, always shown under the input (`USERNAME_RULE_TEXT`, `PASSWORD_RULE_TEXT`). */
  description?: string;
  /** Extra input classes, added to the shared height and padding (`font-mono`, a width cap). */
  inputClassName?: string;
  /** Wrapper classes when the input has a trailing spinner (e.g. a width cap so the spinner stays inside the input). */
  inputWrapperClassName?: string;
  /** Shows a small, unannounced spinner at the end of the input while an async check runs. */
  isChecking?: boolean;
  /** Green positive result shown under the rule text when the field is valid (e.g. "Available"). */
  statusMessage?: string;
  /** Reserves one line for the error/status slot so elements below do not shift as messages appear or clear. */
  reserveMessageSpace?: boolean;
} & Pick<
  ComponentProps<'input'>,
  | 'type'
  | 'autoComplete'
  | 'autoCapitalize'
  | 'autoCorrect'
  | 'spellCheck'
  | 'enterKeyHint'
  | 'maxLength'
>) {
  const field = useFieldContext<string>();
  const input = useRef<HTMLInputElement>(null);
  const hasTriedSubmit = useSelector(
    field.form.store,
    (state) => state.submissionAttempts > 0,
  );

  const submitError = field.state.meta.errorMap.onSubmit;
  useEffect(() => {
    // Focus reads the new error out, through aria-describedby.
    if (submitError) input.current?.focus();
  }, [submitError]);

  const inputId = `${field.form.formId}-${field.name}`;
  const isValidating = field.state.meta.isValidating;
  const isShowingError =
    !isValidating && isShowingErrors(field.state.meta, hasTriedSubmit);
  const isShowingStatus =
    !isValidating && !isShowingError && statusMessage !== undefined;
  const hasSpinnerWrapper =
    isChecking !== undefined || inputWrapperClassName !== undefined;

  const inputElement = (
    <Input
      {...inputProps}
      id={inputId}
      name={field.name}
      ref={input}
      aria-invalid={isShowingError}
      aria-describedby={getDescribedBy(
        inputId,
        description !== undefined,
        isShowingError,
        isShowingStatus,
      )}
      value={field.state.value}
      onBlur={field.handleBlur}
      onChange={(event) => {
        field.handleChange(event.target.value);
        // A new value drops the server's error for the old one.
        if (field.state.meta.errorMap.onSubmit) {
          field.setErrorMap({ onSubmit: undefined });
        }
      }}
      className={cn('h-11 px-3 text-base', inputClassName)}
    />
  );

  let feedback: ReactNode = null;
  if (isShowingError) {
    feedback = (
      <FieldError
        id={`${inputId}-error`}
        role={undefined}
        className="flex items-center gap-2 text-[13px] leading-5 font-semibold"
      >
        <CircleAlertIcon aria-hidden className="size-3.5 shrink-0" />
        {field.state.meta.errors.join(' ')}
      </FieldError>
    );
  } else if (isShowingStatus) {
    feedback = (
      <p
        id={`${inputId}-status`}
        className="text-success flex items-center gap-2 text-[13px] leading-5 font-semibold"
      >
        <CheckIcon
          aria-hidden
          strokeWidth={2.5}
          className="size-3.5 shrink-0"
        />
        {statusMessage}
      </p>
    );
  }

  return (
    <Field className="gap-2" data-invalid={isShowingError}>
      <FieldLabel htmlFor={inputId} className="font-semibold">
        {label}
      </FieldLabel>
      {hasSpinnerWrapper ? (
        <div className={cn('relative', inputWrapperClassName)}>
          {inputElement}
          {isChecking && (
            <Spinner
              aria-hidden="true"
              role={undefined}
              aria-label={undefined}
              className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 -translate-y-1/2"
            />
          )}
        </div>
      ) : (
        inputElement
      )}
      {description !== undefined && (
        <FieldDescription id={`${inputId}-description`}>
          {description}
        </FieldDescription>
      )}
      {reserveMessageSpace ? (
        <div className="min-h-5">{feedback}</div>
      ) : (
        feedback
      )}
    </Field>
  );
}

/**
 * Whether to show a field's errors: field-level on-change errors (live username
 * check, current username) show while the User is still in the field; form-level
 * rule errors show once the User has changed the field and left it, or tried to
 * submit, then update live as the User fixes the field.
 */
function isShowingErrors(
  meta: {
    isValid: boolean;
    isDirty: boolean;
    isBlurred: boolean;
    errorSourceMap: { onChange?: 'form' | 'field' };
  },
  hasTriedSubmit: boolean,
): boolean {
  if (meta.isValid) return false;
  if (meta.errorSourceMap.onChange === 'field') return true;
  return (meta.isDirty && meta.isBlurred) || hasTriedSubmit;
}

/**
 * The input's `aria-describedby`: the error or positive status first while it
 * shows, so it is read before the rule text; nothing when there is neither.
 */
function getDescribedBy(
  inputId: string,
  hasDescription: boolean,
  isShowingError: boolean,
  isShowingStatus: boolean,
): string | undefined {
  const ids: string[] = [];
  if (isShowingError) ids.push(`${inputId}-error`);
  else if (isShowingStatus) ids.push(`${inputId}-status`);
  if (hasDescription) ids.push(`${inputId}-description`);
  if (ids.length === 0) return undefined;
  return ids.join(' ');
}
