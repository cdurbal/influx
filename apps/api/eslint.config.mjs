// ESLint configuration for @influx/api (docs/mvp/02-architecture-3-espaces.md §4, §5 and §13.2,
// docs/mvp/21-plan-de-developpement.md §4, J1-E).
// Flat config: for a given file, the LAST block that sets a rule wins, options are not merged.
// Each block below therefore lists every import restriction that applies to its files.
import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";

/** Domains of 02 §8, plus ops (D60), maintenance (E-4, J7 decision 3) and privacy (E-5, J8). */
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
  "maintenance",
  "privacy",
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

// Only src/config/ reads the environment (02 §12.3, 21 J1-D).
const PROCESS_ENV = {
  object: "process",
  property: "env",
  message: "Read configuration through src/config/ only (21 J1-D).",
};

// The response filter cannot be bypassed (21 J1-J N2, F-1): a response reaches the client only
// through its zod schema. Each of these writes a body, or chooses how it is written, outside the
// schema; only src/platform/ and src/server.ts, which build the filter, may use them. Matched on
// any object (no type information here): `reply.raw`, `request.raw` and `String.raw` alike.
const RESPONSE_FILTER_BYPASS_MESSAGE =
  "bypasses the response schemas: only src/platform/ and src/server.ts may use it (21 N2).";
const RESPONSE_FILTER_PROPERTIES = [
  "serializer",
  "setReplySerializer",
  "setSerializerCompiler",
  "hijack",
  "raw",
  "setNotFoundHandler",
].map((property) => ({
  property,
  message: `${property} ${RESPONSE_FILTER_BYPASS_MESSAGE}`,
}));
// A plugin-level onSend or preSerialization hook is invisible to the onRoute check of server.ts.
const RESPONSE_FILTER_HOOKS = {
  selector:
    "CallExpression[callee.property.name='addHook'][arguments.0.value=/^(?:onSend|preSerialization)$/]",
  message: `An onSend or preSerialization hook ${RESPONSE_FILTER_BYPASS_MESSAGE}`,
};

// The client address comes from the relayed x-real-ip only, read by src/platform/client-address.ts
// after the internal secret (03 §6.4 A5): Fastify's request.ip and request.ips are never read,
// anywhere in src/. Nor is the socket (21 §4, J3 security review R-3): `request.socket.remoteAddress`
// is the address of Railway's proxy, shared by every client. `remoteAddress` itself is refused
// too, whatever object holds it (`request.raw.connection.remoteAddress`…).
const CLIENT_IP_PROPERTIES = ["ip", "ips", "socket", "remoteAddress"].map(
  (property) => ({
    property,
    message: `${property} is never read: use clientAddressOf() of src/platform/client-address.ts (03 §6.4 A5).`,
  }),
);
// The client address headers are named by src/platform/client-address.ts only (R-3): a string
// holding x-real-ip or x-forwarded-for, in any letter case, is refused anywhere else in src/.
const CLIENT_ADDRESS_HEADER_PATTERN = "/x-(?:real-ip|forwarded-for)/i";
const CLIENT_ADDRESS_HEADER_MESSAGE =
  "x-real-ip and x-forwarded-for are read by src/platform/client-address.ts only: use clientAddressOf() (03 §6.4 A5, 21 R-3).";
const CLIENT_ADDRESS_HEADER_LITERALS = [
  {
    selector: `Literal[value=${CLIENT_ADDRESS_HEADER_PATTERN}]`,
    message: CLIENT_ADDRESS_HEADER_MESSAGE,
  },
  {
    selector: `TemplateElement[value.raw=${CLIENT_ADDRESS_HEADER_PATTERN}]`,
    message: CLIENT_ADDRESS_HEADER_MESSAGE,
  },
];

// postgres.js `unsafe` runs a text as SQL, with no parameter binding (21 §4, review of J3 commits 5
// and 6, S-1): on the influx_auth and influx_app pools, an injection would read every account.
// Only src/db/pool.ts may use it, for its constant identity query. Matched on any object
// (`sql.unsafe`, `tx.unsafe`, destructuring).
const POSTGRES_UNSAFE = {
  property: "unsafe",
  message:
    "unsafe runs unparameterised SQL: only the constant query of src/db/pool.ts may use it (21 S-1).",
};

// INFLUX never accepts a GoTrue token from a client (21 J3-C rule 3, G-1 point 3): no code of
// src/ reads an `authorization` header. The outgoing one of src/platform/supabase.ts is an object
// key, which this rule does not concern.
const INBOUND_AUTHORIZATION = {
  property: "authorization",
  message:
    "apps/api never reads an authorization header: GoTrue tokens are never accepted (21 J3-C rule 3).",
};

// Cookies are read and written by src/platform/auth-cookies.ts only (21 J3-C rule 8): the cookies
// of the identified surface, and our four names, never another one (`sb-*` of GoTrue included).
const COOKIE_MESSAGE =
  "cookies are read and written through src/platform/auth-cookies.ts only (21 J3-C rule 8).";
const COOKIE_PROPERTIES = [
  "cookie",
  "cookies",
  "setCookie",
  "clearCookie",
  "parseCookie",
  "signCookie",
  "unsignCookie",
].map((property) => ({
  property,
  message: `${property}: ${COOKIE_MESSAGE}`,
}));

function restrictProperties(...restrictions) {
  return { "no-restricted-properties": ["error", ...restrictions] };
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
  // Property restrictions of src/: for a given file the last matching block wins, so each block
  // lists every restriction that applies to its files.
  {
    files: ["src/**/*.ts"],
    rules: {
      ...restrictProperties(
        PROCESS_ENV,
        POSTGRES_UNSAFE,
        INBOUND_AUTHORIZATION,
        ...COOKIE_PROPERTIES,
        ...CLIENT_IP_PROPERTIES,
        ...RESPONSE_FILTER_PROPERTIES,
      ),
      "no-restricted-syntax": [
        "error",
        RESPONSE_FILTER_HOOKS,
        ...CLIENT_ADDRESS_HEADER_LITERALS,
      ],
    },
  },
  {
    files: ["src/config/**/*.ts"],
    rules: restrictProperties(
      POSTGRES_UNSAFE,
      INBOUND_AUTHORIZATION,
      ...COOKIE_PROPERTIES,
      ...CLIENT_IP_PROPERTIES,
      ...RESPONSE_FILTER_PROPERTIES,
    ),
  },
  {
    files: ["src/platform/**/*.ts", "src/server.ts"],
    rules: {
      ...restrictProperties(
        PROCESS_ENV,
        POSTGRES_UNSAFE,
        INBOUND_AUTHORIZATION,
        ...COOKIE_PROPERTIES,
        ...CLIENT_IP_PROPERTIES,
      ),
      "no-restricted-syntax": ["error", ...CLIENT_ADDRESS_HEADER_LITERALS],
    },
  },
  {
    // The one reader and writer of cookies (J3-C rule 8).
    files: ["src/platform/auth-cookies.ts"],
    rules: restrictProperties(
      PROCESS_ENV,
      POSTGRES_UNSAFE,
      INBOUND_AUTHORIZATION,
      ...CLIENT_IP_PROPERTIES,
    ),
  },
  {
    files: ["src/platform/client-address.ts"],
    rules: { "no-restricted-syntax": "off" },
  },
  {
    // The one exemption of S-1: the constant identity query read when a pool opens.
    files: ["src/db/pool.ts"],
    rules: restrictProperties(
      PROCESS_ENV,
      INBOUND_AUTHORIZATION,
      ...COOKIE_PROPERTIES,
      ...CLIENT_IP_PROPERTIES,
      ...RESPONSE_FILTER_PROPERTIES,
    ),
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
