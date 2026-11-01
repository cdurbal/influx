// ESLint configuration for @influx/ui (docs/mvp/02-architecture-3-espaces.md §21.3 point 7, §21.4;
// arbitration PL-07). The package holds the charter of the connected spaces: tokens and fonts.
// It is the one place that may call `next/font/local` (G4f); it holds no component, no network
// call, no environment read and no data access.
import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";

const PACKAGE_RULE =
  "@influx/ui holds tokens and fonts only: no data access, no network, no environment (02 §21.3).";

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
          paths: [
            {
              name: "next/font/google",
              message: "No third-party fonts (CA11, BO-9).",
            },
          ],
          patterns: [
            {
              regex:
                "^(?:@supabase/|drizzle-orm(?:/|$)|pg(?:/|$)|postgres(?:/|$))",
              message: PACKAGE_RULE,
            },
          ],
        },
      ],
      "no-restricted-globals": [
        "error",
        ...[
          "process",
          "fetch",
          "XMLHttpRequest",
          "WebSocket",
          "EventSource",
        ].map((name) => ({ name, message: PACKAGE_RULE })),
      ],
    },
  },
]);
