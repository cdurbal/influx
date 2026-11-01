// ESLint configuration for @influx/domain (docs/mvp/jalons/l2b/stockage.md §9, D80).
// A domain rule is a pure function: no dependency, no database, no React, no network call, no
// user-facing text, no side effect. Its source may only import its own relative files.
import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";

const DOMAIN_RULE = "The domain package imports only its own relative files.";

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
          patterns: [{ regex: "^(?!\\.{1,2}/)", message: DOMAIN_RULE }],
        },
      ],
      "no-restricted-globals": [
        "error",
        ...["process", "fetch", "console", "Buffer", "require", "URL"].map(
          (name) => ({ name, message: DOMAIN_RULE }),
        ),
      ],
    },
  },
]);
