'use client';

import { PASSWORD_RULE_TEXT } from '@repo/lib/auth/credential-rules';
import { withCredentialFieldGroup } from './credential-form';

/**
 * "New password" with its rule text, then "Confirm new password". Map the
 * form's own field names onto `password` and `confirmPassword` with `fields`.
 */
export const NewPasswordFields = withCredentialFieldGroup({
  defaultValues: { password: '', confirmPassword: '' },
  props: {} as {
    /** Extra input classes, such as a width cap. */
    inputClassName?: string;
  },
  render: function RenderNewPasswordFields({ group, inputClassName }) {
    return (
      <>
        <group.AppField name="password">
          {(field) => (
            <field.CredentialField
              label="New password"
              description={PASSWORD_RULE_TEXT}
              inputClassName={inputClassName}
              type="password"
              autoComplete="new-password"
            />
          )}
        </group.AppField>
        <group.AppField name="confirmPassword">
          {(field) => (
            <field.CredentialField
              label="Confirm new password"
              inputClassName={inputClassName}
              type="password"
              autoComplete="new-password"
              enterKeyHint="done"
            />
          )}
        </group.AppField>
      </>
    );
  },
});
