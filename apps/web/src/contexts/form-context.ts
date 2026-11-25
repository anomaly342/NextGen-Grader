import { createFormHookContexts } from '@tanstack/react-form';

/** The contexts that connect the form module's field components to their field and form. */
export const { fieldContext, formContext, useFieldContext } =
  createFormHookContexts();
