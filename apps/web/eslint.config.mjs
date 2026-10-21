// ESLint configuration for @influx/web.
// Rules map to acceptance criteria of docs/landing-page/00-cadrage.md (see 01-architecture.md §9.2)
// and to docs/mvp/02-architecture-3-espaces.md §13.2. Rules common to both fronts live in
// ../../eslint.front-rules.mjs; only the rules proper to apps/web stay here.
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import jsxA11y from "eslint-plugin-jsx-a11y";
import betterTailwindcss from "eslint-plugin-better-tailwindcss";
import {
  frontRuleBlocks,
  RESTRICTED_CLASSES,
} from "../../eslint.front-rules.mjs";

// `action` and `formAction` were banned while the landing was a mockup (CA8): lifted at J9 commit 5,
// with the fictitious module (02 §13.2). `style` stays banned in ../../eslint.front-rules.mjs.

const WEB_RESTRICTED_IMPORT_PATHS = [
  // Use next-intl's <Link> (src/i18n/navigation.ts) instead: it keeps the locale prefix.
  {
    name: "next/link",
    message: "Use the localized <Link> from @/i18n/navigation.",
  },
  // Kept for good (02 §13.2): forms submit through the API client, never through next/form.
  {
    name: "next/form",
    message: "Forms submit through the API client (02 §13.2).",
  },
];

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
  ...frontRuleBlocks({ importPaths: WEB_RESTRICTED_IMPORT_PATHS }),
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
