import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // Mount gates and derived-state syncs intentionally call setState in an
      // effect; treat the perf hint as a warning rather than a hard error.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  {
    // Vendored cult.ui components — don't fail lint on their style nits.
    files: ["components/ui/**"],
    rules: {
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
]);

export default eslintConfig;
