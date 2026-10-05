// ESLint rules shared by apps/web and apps/backoffice (docs/mvp/02-architecture-3-espaces.md
// §13.2, docs/mvp/03 §7.2 BO-4 and BO-9, docs/mvp/21-plan-de-developpement.md §4 J1-C and J1-E).
// Written once so that a security rule cannot drift between the two fronts.
// Plain data only: no plugin is imported here (plugins resolve from each front, not from the
// root). Rules specific to one front (mockup rules of apps/web, next-intl ban of the backoffice)
// are passed as extras.

/** The only module of a front allowed to call the network (02 §15, rule 3). */
export const API_CLIENT_FILE = "src/server/api-client.ts";

/**
 * The only BROWSER module of a front allowed to call the network: the same-origin relay, /api/v1/…
 * (21 §4, J3 commit 12). Byte-for-byte identical in both fronts, SHA-256 pinned.
 */
export const BROWSER_RELAY_CLIENT_FILE = "src/browser/relay-client.ts";

/** The only directory of a front allowed to read the environment (02 §12.3). */
export const CONFIG_FILES = "src/config/**";

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
  {
    selector: "ExpressionStatement[directive='use server']",
    message:
      "No Server Actions: contracts are explicit, in packages/contracts (02 §13.2).",
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

const FRONT_RESTRICTED_IMPORT_PATHS = [
  { name: "next/script", message: "No scripts (CA11, BO-9)." },
  { name: "next/font/google", message: "No third-party fonts (CA11, BO-9)." },
];

/** 02 §2.1 made structural: a front never reaches the database. */
const DATA_LAYER_IMPORT_PATTERNS = [
  {
    regex: "^(?:@supabase/|drizzle-orm(?:/|$)|pg(?:/|$)|postgres(?:/|$))",
    message:
      "A front never imports @supabase/*, drizzle-orm, pg or postgres: it calls apps/api (02 §2.1, §13.2).",
  },
];

const NETWORK_MESSAGE =
  "Only src/server/api-client.ts (server) and src/browser/relay-client.ts (browser, same-origin relay) call the network (02 §13.2, 21 J1-C).";
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
  message: "A front reads the environment in src/config/ only (02 §12.3).",
};

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
} = {}) {
  return [
    "error",
    {
      paths: [...FRONT_RESTRICTED_IMPORT_PATHS, ...importPaths],
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
  const globals = (names, message) => names.map((name) => ({ name, message }));
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
        "no-restricted-globals": [
          "error",
          ...globals(NETWORK_GLOBALS, NETWORK_MESSAGE),
          ...globals(STORAGE_GLOBALS, STORAGE_MESSAGE),
        ],
        "no-restricted-properties": [
          "error",
          ...NETWORK_PROPERTIES,
          ...STORAGE_PROPERTIES,
        ],
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
        "no-restricted-properties": [
          "error",
          ...NETWORK_PROPERTIES,
          ...STORAGE_PROPERTIES,
          PROCESS_ENV,
        ],
      },
    },
    {
      // The two exceptions to the network ban: the global fetch, in the API client (server) and
      // in the relay client (browser, same origin) only.
      files: [API_CLIENT_FILE, BROWSER_RELAY_CLIENT_FILE],
      rules: {
        "no-restricted-globals": [
          "error",
          ...globals(
            NETWORK_GLOBALS.filter((name) => name !== "fetch"),
            NETWORK_MESSAGE,
          ),
          ...globals(STORAGE_GLOBALS, STORAGE_MESSAGE),
        ],
      },
    },
  ];
}
