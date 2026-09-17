// ESLint configuration for @influx/web.
// Rules map to acceptance criteria of docs/landing-page/00-cadrage.md (see 01-architecture.md §9.2).
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import jsxA11y from "eslint-plugin-jsx-a11y";
import betterTailwindcss from "eslint-plugin-better-tailwindcss";

// CA11, CA22, CA8, CA23: forbidden JSX syntax.
// Real in-app navigation (href, next-intl Link) was reintroduced on 2026-09-17 for the
// clickable account/login prototype — see docs/landing-page/00-cadrage.md §6. Third-party
// embeds stay forbidden (CA11): no iframe, script, video, audio, embed or object element.
const RESTRICTED_SYNTAX = [
  {
    selector:
      "JSXOpeningElement[name.name=/^(iframe|script|video|audio|embed|object)$/]",
    message: "Forbidden element in the mockup (CA11).",
  },
  {
    selector: "JSXAttribute[name.name='style']",
    message: "No inline style: use token-based utility classes (CA22).",
  },
  {
    selector: "JSXAttribute[name.name=/^(action|formAction)$/]",
    message: "The mockup form sends nothing (CA8).",
  },
  {
    selector: "ExpressionStatement[directive='use server']",
    message: "No Server Actions in apps/web (01 §2).",
  },
  {
    selector:
      "JSXAttribute[name.name=/^(alt|aria-label|aria-roledescription|title|placeholder)$/] > Literal[value=/\\S/]",
    message: "Accessible text must come from translation files (CA23).",
  },
  {
    selector:
      "JSXAttribute[name.name=/^(alt|aria-label|aria-roledescription|title|placeholder)$/] > JSXExpressionContainer > Literal[value=/\\S/]",
    message: "Accessible text must come from translation files (CA23).",
  },
];

const RESTRICTED_IMPORT_PATHS = [
  // Use next-intl's <Link> (src/i18n/navigation.ts) instead: it keeps the locale prefix.
  { name: "next/link", message: "Use the localized <Link> from @/i18n/navigation." },
  { name: "next/form", message: "The mockup form sends nothing (CA8)." },
  { name: "next/script", message: "No scripts (CA11)." },
  { name: "next/font/google", message: "No third-party fonts (CA11)." },
];

const PLACEHOLDERS_IMPORT_PATTERN = {
  regex: "(^|/)placeholders(/|$)",
  message:
    "Fictitious content is only imported by src/app/[locale]/layout.tsx and page.tsx (CA15).",
};

// CA8, CA11: no network, no storage.
const RESTRICTED_GLOBALS = [
  "fetch",
  "XMLHttpRequest",
  "WebSocket",
  "EventSource",
  "localStorage",
  "sessionStorage",
  "indexedDB",
  "cookieStore",
].map((name) => ({ name, message: "Mockup: no network or storage (CA8)." }));

const STORAGE_OR_NETWORK_PROPERTIES = [
  ["document", "cookie"],
  ["navigator", "sendBeacon"],
  ["window", "fetch"],
  ["window", "localStorage"],
  ["window", "sessionStorage"],
  ["window", "indexedDB"],
  ["globalThis", "fetch"],
  ["globalThis", "localStorage"],
  ["globalThis", "sessionStorage"],
].map(([object, property]) => ({
  object,
  property,
  message: "Mockup: no network or storage (CA8).",
}));

// CA22: only token-based classes.
const RESTRICTED_CLASSES = [
  {
    pattern: "\\[",
    message: "Arbitrary values are forbidden: use a token (CA22).",
  },
  {
    pattern: "^(.*:)?-?(z|duration|delay|opacity)-\\d+$",
    message: "Numeric z-index, duration, delay or opacity: use a token (CA22).",
  },
  {
    pattern: "[a-z]/\\d+$",
    message: "Numeric opacity modifier: use a token (CA22).",
  },
  {
    pattern:
      "^(.*:)?(border|border-[xytrblse]|outline|outline-offset|ring|ring-offset|divide-[xy])(-\\d+)?$",
    message:
      "Implicit or numeric border width: use border-(length:--border-width-…) (CA22).",
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
      "no-restricted-syntax": ["error", ...RESTRICTED_SYNTAX],
      "no-restricted-imports": [
        "error",
        {
          paths: RESTRICTED_IMPORT_PATHS,
          patterns: [PLACEHOLDERS_IMPORT_PATTERN],
        },
      ],
      "no-restricted-globals": ["error", ...RESTRICTED_GLOBALS],
      "no-restricted-properties": ["error", ...STORAGE_OR_NETWORK_PROPERTIES],
      "react/jsx-no-literals": [
        "error",
        { noStrings: true, ignoreProps: true },
      ],
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
  {
    // The only two entry points allowed to read the fictitious module (01 §6.1).
    files: ["src/app/\\[locale\\]/layout.tsx", "src/app/\\[locale\\]/page.tsx"],
    rules: {
      "no-restricted-imports": ["error", { paths: RESTRICTED_IMPORT_PATHS }],
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
