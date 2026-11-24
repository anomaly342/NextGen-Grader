import { FieldError } from '@repo/ui/field';
import { CircleAlertIcon } from 'lucide-react';

/**
 * One field's error under its input in a Credential form: an alert icon and
 * bold small text, so the error does not rely on color alone. Not a live
 * region; the input links it with `aria-describedby={id}`.
 */
export function CredentialFieldError({
  id,
  children,
}: {
  /** The error's id, for the input's `aria-describedby`. */
  id: string;
  /** The error message. */
  children: string;
}) {
  return (
    <FieldError
      id={id}
      role={undefined}
      className="flex items-center gap-2 text-[13px] font-semibold"
    >
      <CircleAlertIcon aria-hidden className="size-3.5 shrink-0" />
      {children}
    </FieldError>
  );
}
