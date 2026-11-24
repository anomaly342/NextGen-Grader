// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import { ERROR_CODE_COMPARISON } from '../../eslint.shared.mjs';

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
    rules: { '@typescript-eslint/no-deprecated': 'error' },
  },
  {
    // Tests compare against known-good literals on purpose (CODING_STANDARDS.md).
    ignores: ['**/*.test.ts'],
    rules: { 'no-restricted-syntax': ['error', ERROR_CODE_COMPARISON] },
  },
);
