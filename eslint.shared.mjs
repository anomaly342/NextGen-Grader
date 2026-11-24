// no-restricted-syntax and no-restricted-imports entries shared by the workspaces' ESLint configs.

const CODE_NAME = '/(^c|C)ode$/';
const CODE_LITERAL = '/^[A-Z][A-Z0-9_]+$/';

/** `x.code === 'SOME_CODE'` or `errorCode !== 'SOME_CODE'`, either way round. */
export const ERROR_CODE_COMPARISON = {
  selector: [
    `BinaryExpression[operator=/^[!=]==?$/][left.name=${CODE_NAME}][right.value=${CODE_LITERAL}]`,
    `BinaryExpression[operator=/^[!=]==?$/][left.property.name=${CODE_NAME}][right.value=${CODE_LITERAL}]`,
    `BinaryExpression[operator=/^[!=]==?$/][right.name=${CODE_NAME}][left.value=${CODE_LITERAL}]`,
    `BinaryExpression[operator=/^[!=]==?$/][right.property.name=${CODE_NAME}][left.value=${CODE_LITERAL}]`,
  ].join(', '),
  message:
    "Compare error codes against AUTH_ERROR_CODE from '@repo/lib/auth/error-codes', not a string.",
};

/** `{ code: 'SOME_CODE' }` in an error body the API throws. */
export const ERROR_CODE_PROPERTY = {
  selector: `Property[key.name='code'][value.value=${CODE_LITERAL}]`,
  message:
    "Throw with a code from AUTH_ERROR_CODE ('@repo/lib/auth/error-codes'), not a string.",
};

/** `interface FooProps` / `type FooProps` for a React component. */
export const NAMED_PROPS_TYPE = {
  selector:
    'TSInterfaceDeclaration[id.name=/Props$/], TSTypeAliasDeclaration[id.name=/Props$/]',
  message:
    'Write component props inline in the signature: ({ a }: { a: string }).',
};

/** `@repo/ui/components/button` instead of `@repo/ui/button`. */
export const UI_COMPONENTS_IMPORT = {
  group: ['@repo/ui/components/*'],
  message: "Import shadcn components as '@repo/ui/<name>'.",
};
