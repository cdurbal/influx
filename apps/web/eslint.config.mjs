// ESLint configuration for @influx/web.
// Rules map to acceptance criteria of docs/landing-page/00-cadrage.md (see 01-architecture.md §9.2)
// and to docs/mvp/02-architecture-3-espaces.md §13.2. Rules common to both fronts live in
// ../../eslint.front-rules.mjs; only the mockup rules of the landing page stay here.
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import jsxA11y from "eslint-plugin-jsx-a11y";
import betterTailwindcss from "eslint-plugin-better-tailwindcss";
import {
  frontRestrictedImports,
  frontRuleBlocks,
  RESTRICTED_CLASSES,
} from "../../eslint.front-rules.mjs";

// CA8: the mockup form sends nothing (lifted at Lot 1, 02 §13.2).
// Real in-app navigation (href, next-intl Link) was reintroduced on 2026-09-17 for the
// clickable account/login prototype — see docs/landing-page/00-cadrage.md §6.
const MOCKUP_RESTRICTED_SYNTAX = [
  {
    selector: "JSXAttribute[name.name=/^(action|formAction)$/]",
    message: "The mockup form sends nothing (CA8).",
  },
];

const WEB_RESTRICTED_IMPORT_PATHS = [
  // Use next-intl's <Link> (src/i18n/navigation.ts) instead: it keeps the locale prefix.
  {
    name: "next/link",
    message: "Use the localized <Link> from @/i18n/navigation.",
  },
  { name: "next/form", message: "The mockup form sends nothing (CA8)." },
];

const PLACEHOLDERS_IMPORT_PATTERN = {
  regex: "(^|/)placeholders(/|$)",
  message:
    "Fictitious content is only imported by src/app/[locale]/layout.tsx and page.tsx (CA15).",
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
  ...frontRuleBlocks({
    restrictedSyntax: MOCKUP_RESTRICTED_SYNTAX,
    importPaths: WEB_RESTRICTED_IMPORT_PATHS,
    importPatterns: [PLACEHOLDERS_IMPORT_PATTERN],
  }),
  {
    // The only two entry points allowed to read the fictitious module (01 §6.1).
    files: ["src/app/\\[locale\\]/layout.tsx", "src/app/\\[locale\\]/page.tsx"],
    rules: {
      "no-restricted-imports": frontRestrictedImports({
        importPaths: WEB_RESTRICTED_IMPORT_PATHS,
      }),
    },
  },
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
