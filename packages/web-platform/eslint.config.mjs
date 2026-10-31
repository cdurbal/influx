// ESLint configuration for @influx/web-platform (docs/mvp/02-architecture-3-espaces.md §8 and §13.2,
// §21.3 point 7; arbitration PL-07, PL-09). The package holds the plumbing of both fronts: the relay
// (03 PP-12), its browser client, the error collector and the hydration marker. The import, network
// and storage bans are those of the fronts, read from ../../eslint.front-rules.mjs so that they
// cannot drift; the only two exceptions to the ban of `fetch`, and the only read of process.env,
// are granted here, to the files named below.
import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";
import {
  frontRestrictedImports,
  networkGlobalsRule,
  networkPropertiesRule,
  USE_SERVER_RESTRICTION,
} from "../../eslint.front-rules.mjs";

/** The only server module allowed to call the network (02 §15, rule 3). */
export const API_CLIENT_FILE = "src/server/api-client.ts";

/** The only browser module allowed to call the network: the same-origin relay (21 §4, J3 commit 12). */
export const BROWSER_RELAY_CLIENT_FILE = "src/browser/relay-client.ts";

/** The only module allowed to read the environment: the relay configuration (02 §12.3, D64). */
export const CONFIG_FILE = "src/config/server.ts";

const NO_ELEMENT = {
  selector: "JSXElement, JSXFragment",
  message:
    "@influx/web-platform renders no element: components belong to a front (02 §8).",
};

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
    files: ["**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": ["error", USE_SERVER_RESTRICTION, NO_ELEMENT],
      "no-restricted-imports": frontRestrictedImports(),
      "no-restricted-globals": networkGlobalsRule(),
      "no-restricted-properties": networkPropertiesRule(),
    },
  },
  {
    files: [CONFIG_FILE],
    rules: {
      "no-restricted-properties": networkPropertiesRule({
        allowProcessEnv: true,
      }),
    },
  },
  {
    // The two exceptions to the network ban: the global fetch, in the API client (server) and in
    // the relay client (browser, same origin) only.
    files: [API_CLIENT_FILE, BROWSER_RELAY_CLIENT_FILE],
    rules: {
      "no-restricted-globals": networkGlobalsRule({ allowFetch: true }),
    },
  },
]);
