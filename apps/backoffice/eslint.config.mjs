// ESLint configuration for @influx/backoffice (docs/mvp/02-architecture-3-espaces.md §13.2,
// docs/mvp/03 §7.2, docs/mvp/21-plan-de-developpement.md §4 J1-E). Rules common to both fronts
// live in ../../eslint.front-rules.mjs; only the backoffice-specific ban is added here.
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import jsxA11y from "eslint-plugin-jsx-a11y";
import betterTailwindcss from "eslint-plugin-better-tailwindcss";
import {
  frontRuleBlocks,
  RESTRICTED_CLASSES,
} from "../../eslint.front-rules.mjs";

// D36 is open: the backoffice stays in French, without next-intl (02 §8 and §14.3).
const NEXT_INTL_IMPORT_PATTERN = {
  regex: "^next-intl(?:/|$)",
  message:
    "No next-intl in the backoffice while D36 is open: labels live in src/messages/fr.ts (02 §8).",
};

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
  {
    linterOptions: {
      reportUnusedDisableDirectives: "error",
    },
  },
  {
    files: ["**/*.{ts,tsx,mjs}"],
    rules: {
      ...jsxA11y.flatConfigs.recommended.rules,
    },
  },
  ...frontRuleBlocks({ importPatterns: [NEXT_INTL_IMPORT_PATTERN] }),
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: {
      "better-tailwindcss": betterTailwindcss,
    },
    settings: {
      "better-tailwindcss": {
        entryPoint: "src/app/globals.css",
      },
    },
    rules: {
      ...betterTailwindcss.configs["correctness-error"].rules,
      "better-tailwindcss/no-restricted-classes": [
        "error",
        { restrict: RESTRICTED_CLASSES },
      ],
    },
  },
]);
