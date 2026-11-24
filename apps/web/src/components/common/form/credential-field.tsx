'use client';

import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from '@repo/ui/field';
import { Input } from '@repo/ui/input';
import { cn } from '@repo/ui/lib/utils';
import { useSelector } from '@tanstack/react-form';
import { CircleAlertIcon } from 'lucide-react';
import { useEffect, useRef, type ComponentProps } from 'react';
import { useFieldContext } from '@/contexts/form-context';

/**
 * A labelled input for the field in context, with optional rule text under it
 * and one error. The form passes what makes it a username, new password,
 * confirmation or current password (`type`, `autoComplete`, rule text). Its id is the form's `formId` plus the field name. It owns
 * when the error shows, the invalid mark and description link, clearing a
 * submit error when the User types, and taking focus when one arrives.
 */
export function CredentialField({
  label,
  description,
  inputClassName,
  ...inputProps
}: {
  /** The visible label ("Username", "New password"). */
  label: string;
  /** Rule text, always shown under the input (`USERNAME_RULE_TEXT`, `PASSWORD_RULE_TEXT`). */
  description?: string;
  /** Extra input classes, added to the shared height and padding (`font-mono`, a width cap). */
  inputClassName?: string;
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
  const isShowingError = isShowingErrors(field.state.meta, hasTriedSubmit);

  return (
    <Field className="gap-2" data-invalid={isShowingError}>
      <FieldLabel htmlFor={inputId} className="font-semibold">
        {label}
      </FieldLabel>
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
      {description !== undefined && (
        <FieldDescription id={`${inputId}-description`}>
          {description}
        </FieldDescription>
      )}
      {isShowingError && (
        <FieldError
          id={`${inputId}-error`}
          role={undefined}
          className="flex items-center gap-2 text-[13px] font-semibold"
        >
          <CircleAlertIcon aria-hidden className="size-3.5 shrink-0" />
          {field.state.meta.errors.join(' ')}
        </FieldError>
      )}
    </Field>
  );
}

/**
 * Whether to show a field's errors: once the User has changed it and left it,
 * or tried to submit. Not on a field they only tabbed through (the form-level
 * validator gives every field its errors on any change), and not while they
 * first type in it. After that they update live as the User fixes the field.
 */
function isShowingErrors(
  meta: { isValid: boolean; isDirty: boolean; isBlurred: boolean },
  hasTriedSubmit: boolean,
): boolean {
  return !meta.isValid && ((meta.isDirty && meta.isBlurred) || hasTriedSubmit);
}

/**
 * The input's `aria-describedby`: the error first while it shows, so it is
 * read before the rule text; nothing when there is neither.
 */
function getDescribedBy(
  inputId: string,
  hasDescription: boolean,
  isShowingError: boolean,
): string | undefined {
  const ids: string[] = [];
  if (isShowingError) ids.push(`${inputId}-error`);
  if (hasDescription) ids.push(`${inputId}-description`);
  if (ids.length === 0) return undefined;
  return ids.join(' ');
}
