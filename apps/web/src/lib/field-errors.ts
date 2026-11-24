/** The part of a TanStack Form field's meta that decides when its errors show. */
interface FieldErrorMeta {
  isValid: boolean;
  isDirty: boolean;
  isBlurred: boolean;
}

/**
 * Whether to show a field's errors: once the User has changed it and left it,
 * or tried to submit. Not on a field they only tabbed through (the form-level
 * validator gives every field its errors on any change), and not while they
 * first type in it. After that they update live as the User fixes the field.
 */
export function isShowingErrors(
  meta: FieldErrorMeta,
  hasTriedSubmit: boolean,
): boolean {
  return !meta.isValid && ((meta.isDirty && meta.isBlurred) || hasTriedSubmit);
}

/**
 * `aria-describedby` for an input with rule text under it (`<inputId>-description`):
 * the error (`<inputId>-error`) first while it shows, so it is read before the rules.
 */
export function getDescribedBy(
  inputId: string,
  isShowingError: boolean,
): string {
  return isShowingError
    ? `${inputId}-error ${inputId}-description`
    : `${inputId}-description`;
}
