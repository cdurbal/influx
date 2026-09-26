// ESLint configuration for @influx/api (docs/mvp/02-architecture-3-espaces.md §4, §5 and §13.2,
// docs/mvp/21-plan-de-developpement.md §4, J1-E).
// Flat config: for a given file, the LAST block that sets a rule wins, options are not merged.
// Each block below therefore lists every import restriction that applies to its files.
import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";

/** Domains of 02 §8, plus ops (D60). */
const DOMAINS = [
  "identity",
  "profiles",
  "campaigns",
  "search",
  "verification",
  "matching",
  "messaging",
  "billing",
  "leads",
  "backoffice",
  "ops",
];

const SUPABASE = {
  regex: "^@supabase/",
  message:
    "@supabase/* is imported only by src/platform/supabase.ts (02 §13.2).",
};
const DRIZZLE = {
  regex: "^drizzle-orm(?:/|$)",
  message:
    "drizzle-orm is imported only by src/db/** and repository.ts files (02 §5, rule 6).",
};
const POSTGRES = {
  regex: "^postgres$",
  message: "postgres is imported only by src/db/** (02 §5).",
};

function otherDomainRepository(domain) {
  const others = DOMAINS.filter((name) => name !== domain).join("|");
  return {
    regex: `(?:^|/)(?:${others})/repository(?:\\.ts)?$`,
    message:
      "A domain never imports the repository.ts of another domain: call its service.ts (02 §4, rule 2).",
  };
}

function restrictImports(...patterns) {
  return { "no-restricted-imports": ["error", { patterns }] };
}

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
      // Logs go through pino (02 §4, rule 3).
      "no-console": "error",
      ...restrictImports(SUPABASE, DRIZZLE, POSTGRES),
    },
  },
  {
    // Only src/config/ reads the environment (02 §12.3, 21 J1-D).
    files: ["src/**/*.ts"],
    ignores: ["src/config/**"],
    rules: {
      "no-restricted-properties": [
        "error",
        {
          object: "process",
          property: "env",
          message: "Read configuration through src/config/ only (21 J1-D).",
        },
      ],
    },
  },
  {
    files: ["src/platform/supabase.ts"],
    rules: restrictImports(DRIZZLE, POSTGRES),
  },
  {
    files: ["src/db/**/*.ts"],
    rules: restrictImports(SUPABASE),
  },
  {
    // Database tests talk to the local stack through the harness of @influx/test-kit, which is
    // built on the postgres driver (18 §9.3 A-2).
    files: ["db-tests/**/*.ts"],
    rules: restrictImports(SUPABASE, DRIZZLE),
  },
  ...DOMAINS.flatMap((domain) => [
    {
      files: [`src/domains/${domain}/**/*.ts`],
      rules: restrictImports(
        SUPABASE,
        DRIZZLE,
        POSTGRES,
        otherDomainRepository(domain),
      ),
    },
    {
      files: [`src/domains/${domain}/**/repository.ts`],
      rules: restrictImports(SUPABASE, POSTGRES, otherDomainRepository(domain)),
    },
  ]),
]);
