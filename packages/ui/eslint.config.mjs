// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import { NAMED_PROPS_TYPE, UI_COMPONENTS_IMPORT } from '../../eslint.shared.mjs';

export default tseslint.config(
  { ignores: ['eslint.config.mjs'] },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      'no-restricted-imports': ['error', { patterns: [UI_COMPONENTS_IMPORT] }],
      '@typescript-eslint/no-deprecated': 'error',
    },
  },
  {
    files: ['**/*.tsx'],
    rules: { 'no-restricted-syntax': ['error', NAMED_PROPS_TYPE] },
  },
);
