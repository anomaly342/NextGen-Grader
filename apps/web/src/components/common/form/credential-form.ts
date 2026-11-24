import {
  createFormHook,
  type AnyFormApi,
  type DeepKeys,
} from '@tanstack/react-form';
import { fieldContext, formContext } from '@/contexts/form-context';
import { CredentialField } from './credential-field';

/**
 * The form hook for Credential forms (Credential setup, change username,
 * change password, Password reset): `useCredentialForm` takes `useForm`'s
 * options (pass a `formId`, the prefix of every input id) and its
 * `form.AppField` children render `field.CredentialField`. Other forms get their own hook.
 */
export const {
  useAppForm: useCredentialForm,
  withFieldGroup: withCredentialFieldGroup,
} = createFormHook({
  fieldContext,
  formContext,
  fieldComponents: { CredentialField },
  formComponents: {},
});

/**
 * Shows a server's submit error under the named field. The field component
 * moves focus to its input and clears the error when the User types again.
 */
export function setSubmitError<TForm extends AnyFormApi>(
  form: TForm,
  name: DeepKeys<TForm['state']['values']>,
  message: string,
): void {
  form.setFieldMeta(name, (meta) => ({
    ...meta,
    errorMap: { ...meta.errorMap, onSubmit: message },
  }));
}
