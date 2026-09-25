// ESLint configuration for @influx/contracts (docs/mvp/02-architecture-3-espaces.md §8,
// docs/mvp/21-plan-de-developpement.md §4, J1-E).
// A contract never holds database access, a secret, React, a network call, a user-facing text
// or a side effect: its source may only import zod and its own relative files.
import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";

const CONTRACT_RULE = "Contracts import only zod and relative files (02 §8).";

export default defineConfig([
  globalIgnores(["node_modules/**"]),
  {
    linterOptions: {
      reportUnusedDisableDirectives: "error",
    },
  },
  js.configs.recommended,
  tseslint.configs.strict,
  {
    files: ["**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "no-console": "error",
    },
  },
  {
    files: ["src/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { regex: "^(?!zod$)(?!\\.{1,2}/)", message: CONTRACT_RULE },
          ],
        },
      ],
      "no-restricted-globals": [
        "error",
        ...["process", "fetch", "console", "Buffer", "require"].map((name) => ({
          name,
          message: CONTRACT_RULE,
        })),
      ],
    },
  },
]);
