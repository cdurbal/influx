// ESLint rules shared by apps/web and apps/backoffice (docs/mvp/02-architecture-3-espaces.md
// §13.2, docs/mvp/03 §7.2 BO-4 and BO-9, docs/mvp/21-plan-de-developpement.md §4 J1-C and J1-E).
// Written once so that a security rule cannot drift between the two fronts, nor between them and
// packages/web-platform, whose configuration reads the network, storage and import bans from here.
// Plain data only: no plugin is imported here (plugins resolve from each front, not from the
// root). Rules specific to one front (mockup rules of apps/web, next-intl ban of the backoffice)
// are passed as extras.
//
// Since PL-09 (arbitration PL-07) no file of a front calls the network: the API client and the
// browser relay client live in packages/web-platform, whose eslint.config.mjs holds the only two
// exceptions to the ban of `fetch`.

/**
 * The only directory of a front allowed to read the environment (02 §12.3): its
 * src/config/security-headers.ts (NODE_ENV). The relay configuration left it at PL-09.
 */
export const CONFIG_FILES = "src/config/**";

/** No Server Action (02 §13.2), in the fronts and in packages/web-platform. */
export const USE_SERVER_RESTRICTION = {
  selector: "ExpressionStatement[directive='use server']",
  message:
    "No Server Actions: contracts are explicit, in packages/contracts (02 §13.2).",
};

const FRONT_RESTRICTED_SYNTAX = [
  {
    // CA11, BO-9: no third-party embed, no script tag.
    selector:
      "JSXOpeningElement[name.name=/^(iframe|script|video|audio|embed|object)$/]",
    message: "Forbidden element: no embed and no script tag (CA11, BO-9).",
  },
  {
    selector: "JSXAttribute[name.name='style']",
    message: "No inline style: use token-based utility classes (CA22).",
  },
  USE_SERVER_RESTRICTION,
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

const FRONT_RESTRICTED_IMPORT_PATHS = [
  { name: "next/script", message: "No scripts (CA11, BO-9)." },
  { name: "next/font/google", message: "No third-party fonts (CA11, BO-9)." },
  // G4f, 02 §21.4 point 1: the self-hosted fonts are declared once, in packages/ui (PL-07).
  {
    name: "next/font/local",
    message:
      "Fonts are declared in packages/ui (@influx/ui/fonts) only (02 §21.4, G4f).",
  },
  // 02 §21.5: one module per front is the single import point of the icons.
  {
    name: "lucide-react",
    message: "Import icons from the icons.ts module of the front (02 §21.5).",
  },
];

/** The only module of a front allowed to import `lucide-react` (02 §21.5). */
export const ICONS_FILES = "src/**/icons.ts";

/** 02 §2.1 made structural: a front never reaches the database. */
const DATA_LAYER_IMPORT_PATTERNS = [
  {
    regex: "^(?:@supabase/|drizzle-orm(?:/|$)|pg(?:/|$)|postgres(?:/|$))",
    message:
      "A front never imports @supabase/*, drizzle-orm, pg or postgres: it calls apps/api (02 §2.1, §13.2).",
  },
];

const NETWORK_MESSAGE =
  "Only src/server/api-client.ts (server) and src/browser/relay-client.ts (browser, same-origin relay) of packages/web-platform call the network (02 §13.2, 21 J1-C, PL-09).";
const STORAGE_MESSAGE =
  "No browser storage: the session is an httpOnly cookie (02 §13.2, D37).";

const NETWORK_GLOBALS = ["fetch", "XMLHttpRequest", "WebSocket", "EventSource"];
const STORAGE_GLOBALS = [
  "localStorage",
  "sessionStorage",
  "indexedDB",
  "cookieStore",
];

const NETWORK_PROPERTIES = [
  ["window", "fetch"],
  ["globalThis", "fetch"],
].map(([object, property]) => ({ object, property, message: NETWORK_MESSAGE }));

const STORAGE_PROPERTIES = [
  ["document", "cookie"],
  ["navigator", "sendBeacon"],
  ["window", "localStorage"],
  ["window", "sessionStorage"],
  ["window", "indexedDB"],
  ["globalThis", "localStorage"],
  ["globalThis", "sessionStorage"],
].map(([object, property]) => ({ object, property, message: STORAGE_MESSAGE }));

const PROCESS_ENV = {
  object: "process",
  property: "env",
  message:
    "The environment is read in src/config/ only, the relay's in packages/web-platform/src/config/server.ts (02 §12.3).",
};

const restrictedGlobals = (names, message) =>
  names.map((name) => ({ name, message }));

/**
 * `no-restricted-globals` of the network and storage bans. `allowFetch`: the global fetch, for the
 * two network files of packages/web-platform only (its eslint.config.mjs).
 */
export function networkGlobalsRule({ allowFetch = false } = {}) {
  return [
    "error",
    ...restrictedGlobals(
      NETWORK_GLOBALS.filter((name) => !allowFetch || name !== "fetch"),
      NETWORK_MESSAGE,
    ),
    ...restrictedGlobals(STORAGE_GLOBALS, STORAGE_MESSAGE),
  ];
}

/** `no-restricted-properties` of the network and storage bans, with `process.env` unless allowed. */
export function networkPropertiesRule({ allowProcessEnv = false } = {}) {
  return [
    "error",
    ...NETWORK_PROPERTIES,
    ...STORAGE_PROPERTIES,
    ...(allowProcessEnv ? [] : [PROCESS_ENV]),
  ];
}

/** CA22: only token-based classes. */
export const RESTRICTED_CLASSES = [
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

/** Value of `no-restricted-imports`: the common bans plus the extras of one front. */
export function frontRestrictedImports({
  importPaths = [],
  importPatterns = [],
  allow = [],
} = {}) {
  return [
    "error",
    {
      paths: [...FRONT_RESTRICTED_IMPORT_PATHS, ...importPaths].filter(
        ({ name }) => !allow.includes(name),
      ),
      patterns: [...DATA_LAYER_IMPORT_PATTERNS, ...importPatterns],
    },
  ];
}

/** Config blocks of the common rules, to spread in the eslint.config.mjs of each front. */
export function frontRuleBlocks({
  restrictedSyntax = [],
  importPaths = [],
  importPatterns = [],
} = {}) {
  return [
    {
      files: ["**/*.{ts,tsx,mjs}"],
      rules: {
        "no-restricted-syntax": [
          "error",
          ...FRONT_RESTRICTED_SYNTAX,
          ...restrictedSyntax,
        ],
        "no-restricted-imports": frontRestrictedImports({
          importPaths,
          importPatterns,
        }),
        "no-restricted-globals": networkGlobalsRule(),
        "no-restricted-properties": networkPropertiesRule({
          allowProcessEnv: true,
        }),
        "react/jsx-no-literals": [
          "error",
          { noStrings: true, ignoreProps: true },
        ],
        // B10, BO-4: no user content is ever rendered as HTML.
        "react/no-danger": "error",
        "@typescript-eslint/no-explicit-any": "error",
      },
    },
    {
      // Only src/config/ reads process.env (02 §12.3).
      files: ["src/**/*.{ts,tsx}"],
      ignores: [CONFIG_FILES],
      rules: {
        "no-restricted-properties": networkPropertiesRule(),
      },
    },
    {
      // 02 §21.5: the icons module of the front owns the import of lucide-react. (next/font/local
      // has no owner in a front since PL-08: packages/ui/eslint.config.mjs allows it there.)
      files: [ICONS_FILES],
      rules: {
        "no-restricted-imports": frontRestrictedImports({
          importPaths,
          importPatterns,
          allow: ["lucide-react"],
        }),
      },
    },
    // No exception to the network ban in a front since PL-09: the two files that call fetch are
    // in packages/web-platform, and its eslint.config.mjs lifts the ban for them alone.
  ];
}
