import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import {
  ERROR_CODE_COMPARISON,
  NAMED_PROPS_TYPE,
  UI_COMPONENTS_IMPORT,
} from "../../eslint.shared.mjs";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "no-restricted-imports": ["error", { patterns: [UI_COMPONENTS_IMPORT] }],
      "no-restricted-syntax": ["error", ERROR_CODE_COMPARISON],
    },
  },
  {
    // A later no-restricted-syntax replaces the earlier one, so repeat the shared entry.
    files: ["**/*.tsx"],
    rules: {
      "no-restricted-syntax": ["error", ERROR_CODE_COMPARISON, NAMED_PROPS_TYPE],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
