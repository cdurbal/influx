// Shared guard helpers of the front applications (docs/mvp/18-plan-de-test-mvp.md §5,
// docs/mvp/21-plan-de-developpement.md §4, J1-C and J1-E).
// File reading only: deterministic, no browser, no network. Each helper returns its findings;
// the assertion (an empty list) stays in the guard test of each application.
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

/** Every file under a directory, recursively. */
export function listFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const fullPath = path.join(directory, entry);
    return statSync(fullPath).isDirectory() ? listFiles(fullPath) : [fullPath];
  });
}

/** Path of a file relative to a root, with forward slashes on every platform. */
export function relativePath(root: string, file: string): string {
  return path.relative(root, file).split(path.sep).join("/");
}

/** Every line matching the pattern, as "relative/path:line: text". */
export function findMatches(
  pattern: RegExp,
  files: readonly string[],
  root: string,
): string[] {
  // A global or sticky regular expression keeps state between calls to test(): drop those flags.
  const matcher = new RegExp(
    pattern.source,
    pattern.flags.replace(/[gy]/g, ""),
  );
  return files.flatMap((file) =>
    readFileSync(file, "utf8")
      .split("\n")
      .flatMap((line, index) =>
        matcher.test(line)
          ? [`${relativePath(root, file)}:${index + 1}: ${line.trim()}`]
          : [],
      ),
  );
}

// ---------------------------------------------------------------------------------------------
// G3: no hard-coded color or length outside the token files (CA22, CLAUDE.md §10.3 rule 7)
// ---------------------------------------------------------------------------------------------

/** Hexadecimal color or CSS color function. */
export const HARD_CODED_COLOR_PATTERN =
  /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b|\b(?:rgba?|hsla?|oklch|oklab|color-mix)\(/;

/** Literal length (px, rem, em, vh, vw, ch). */
export const HARD_CODED_LENGTH_PATTERN =
  /\b\d*\.?\d+(?:px|rem|em|d?vh|d?vw|ch)\b/;

// ---------------------------------------------------------------------------------------------
// G7: no Tailwind class conflict that cn() cannot resolve (10 #10)
// ---------------------------------------------------------------------------------------------
// cn() only joins classes: when two utilities of the same group apply at the same variant, the
// order of the compiled CSS wins, not the order of the call (cause of 09 A1 and 10 #1 to #3).
// Checked groups are those that broke the page: width and white-space.

export const TAILWIND_CONFLICT_GROUPS: ReadonlyArray<{
  name: string;
  pattern: RegExp;
}> = [
  { name: "width", pattern: /^w-/ },
  { name: "white-space", pattern: /^whitespace-/ },
];

/** Returns the argument text of every cn(...) call, with balanced parentheses. */
export function cnCalls(source: string): string[] {
  const calls: string[] = [];
  for (const match of source.matchAll(/\bcn\(/g)) {
    const start = match.index + match[0].length;
    let depth = 1;
    let end = start;
    while (end < source.length && depth > 0) {
      if (source[end] === "(") depth += 1;
      if (source[end] === ")") depth -= 1;
      end += 1;
    }
    calls.push(source.slice(start, end - 1));
  }
  return calls;
}

/** Class names found in the double-quoted string literals of a text. */
export function classesOf(text: string): string[] {
  return [...text.matchAll(/"([^"]*)"/g)].flatMap((literal) =>
    (literal[1] ?? "").split(/\s+/).filter(Boolean),
  );
}

/** Group keys ("sm:|width") that appear more than once in the class list. */
export function classConflicts(classes: readonly string[]): string[] {
  const seen = new Map<string, number>();
  for (const className of classes) {
    const separator = className.lastIndexOf(":");
    const variant = className.slice(0, separator + 1);
    const utility = className.slice(separator + 1);
    const group = TAILWIND_CONFLICT_GROUPS.find(({ pattern }) =>
      pattern.test(utility),
    );
    if (group) {
      const key = `${variant}|${group.name}`;
      seen.set(key, (seen.get(key) ?? 0) + 1);
    }
  }
  return [...seen].filter(([, count]) => count > 1).map(([key]) => key);
}

/** Two widths or two white-space values at the same variant in one class list. */
export function findClassListConflicts(
  componentFiles: readonly string[],
  root: string,
): string[] {
  return componentFiles.flatMap((file) => {
    const source = readFileSync(file, "utf8");
    const lists = [
      ...[...source.matchAll(/className="([^"]*)"/g)].map(
        (match) => `"${match[1] ?? ""}"`,
      ),
      ...cnCalls(source),
    ];
    return lists.flatMap((list) => {
      // Alternatives of a ternary never apply together: check each side apart.
      const sides = list.includes("?") ? list.split(/[?:]\s*(?=")/) : [list];
      return sides.flatMap((side) =>
        classConflicts(classesOf(side)).map(
          (key) => `${relativePath(root, file)}: ${key} in ${side.trim()}`,
        ),
      );
    });
  });
}

/** Width or white-space in the base classes of a primitive that accepts className. */
export function findPrimitiveBaseClassConflicts(
  primitiveFiles: readonly string[],
  root: string,
): string[] {
  return primitiveFiles.flatMap((file) =>
    cnCalls(readFileSync(file, "utf8"))
      .filter((call) => /\bclassName\b/.test(call))
      .flatMap((call) =>
        // Opt-in classes such as `fullWidth && "w-full"` are chosen by the caller: allowed.
        classesOf(
          call
            .slice(0, call.search(/\bclassName\b/))
            .replace(/&&\s*"[^"]*"/g, ""),
        )
          .filter((className) =>
            TAILWIND_CONFLICT_GROUPS.some(({ pattern }) =>
              pattern.test(className),
            ),
          )
          .map((className) => `${relativePath(root, file)}: ${className}`),
      ),
  );
}

// ---------------------------------------------------------------------------------------------
// Network and storage APIs, split at J1 (02 §13.2, 18 §5 annex 2, 21 J1-C)
// ---------------------------------------------------------------------------------------------

/** Network APIs: allowed in the API client only. */
export const NETWORK_API_PATTERN =
  /\bfetch\(|XMLHttpRequest|\bWebSocket\b|\bEventSource\b/;

/** Browser storage APIs: forbidden everywhere, for good (the session is an httpOnly cookie). */
export const STORAGE_API_PATTERN =
  /sendBeacon|localStorage|sessionStorage|indexedDB|document\.cookie|cookieStore/;

// ---------------------------------------------------------------------------------------------
// Relay allow-list: the replacement of G5 (03 PP-12, 18 §5, 21 J1-C)
// ---------------------------------------------------------------------------------------------

/** The four relay files, identical byte for byte in apps/web and apps/backoffice. */
export const RELAY_FILES = {
  route: "src/app/api/[...path]/route.ts",
  relay: "src/server/relay.ts",
  apiClient: "src/server/api-client.ts",
  config: "src/config/server.ts",
} as const;

/**
 * The only browser module that calls the network: the same-origin relay (21 §4, J3 commit 12).
 * Identical in both fronts and pinned, like the relay files: changing it is a conscious gesture.
 */
export const BROWSER_RELAY_CLIENT_FILE = "src/browser/relay-client.ts";
export const BROWSER_RELAY_CLIENT_SHA256 =
  "d7d1d395d0d3ca44489eae5baf15c6f809dc291215bb4bcf0cc7751ecdf6a32f";

/** Every route file allowed under src/app. EC-22 may add the public health route of web. */
export const ALLOWED_ROUTE_FILES: readonly string[] = [RELAY_FILES.route];

/**
 * SHA-256 of the relay files (03 PP-12, T7.8). There is no Pull Request to review a change of
 * these files: changing one requires updating its pin here, in the same commit, and copying the
 * file to the other front. That is the conscious gesture.
 */
export const RELAY_FILE_SHA256: Readonly<Record<string, string>> = {
  [RELAY_FILES.route]:
    "d289b6bdad293b1b51e462458f67fbb78ce0ba946abca1cc389b73a51530e267",
  [RELAY_FILES.relay]:
    "bc93d1d86f20dfde6510515a45f14eb8dc8bb5da4625dd3c90a579a6fbbe7108",
  [RELAY_FILES.apiClient]:
    "e9e52a248631c4d4d4e8438e1b2dcff6fac7d7916e4cd3610139065b4a190503",
  [RELAY_FILES.config]:
    "12e6b15aa8496de30d7015e01d0c8431123ab9150b50c4d11e17e61c6710efdc",
};

const DATA_LAYER_IMPORT =
  /^(?:@supabase\/|drizzle-orm(?:\/|$)|pg(?:\/|$)|postgres(?:\/|$))/;
const PROCESS_ENV_READ = /\bprocess\s*(?:\.\s*env\b|\[\s*["']env["']\s*\])/;
const USE_SERVER_DIRECTIVE = /["']use server["']/;
const SOURCE_FILE = /\.(?:ts|tsx|js|jsx|mjs)$/;

/** Module specifiers of the static imports, re-exports and dynamic imports of a source. */
export function importSpecifiers(source: string): string[] {
  const pattern =
    /\bimport\s*(?:[^'"()]*?\bfrom\s*)?["']([^"']+)["']|\bexport\s[^'"]*?\bfrom\s*["']([^"']+)["']|\bimport\s*\(\s*["']([^"']+)["']\s*\)/g;
  return [...source.matchAll(pattern)].flatMap((match) => {
    const specifier = match[1] ?? match[2] ?? match[3];
    return specifier === undefined ? [] : [specifier];
  });
}

/** Absolute path, without extension, of a relative or "@/" specifier; null for a package. */
function resolveLocalSpecifier(
  frontRoot: string,
  importer: string,
  specifier: string,
): string | null {
  let resolved: string;
  if (specifier.startsWith("./") || specifier.startsWith("../")) {
    resolved = path.resolve(path.dirname(importer), specifier);
  } else if (specifier.startsWith("@/")) {
    resolved = path.join(frontRoot, "src", specifier.slice(2));
  } else {
    return null;
  }
  return resolved.replace(SOURCE_FILE, "");
}

/** Route files under src/app outside the allow-list, and allowed ones that are missing. */
export function findRouteFileViolations(frontRoot: string): string[] {
  const routes = listFiles(path.join(frontRoot, "src", "app"))
    .filter((file) => /[\\/]route\.(?:ts|tsx|js|jsx|mjs)$/.test(file))
    .map((file) => relativePath(frontRoot, file));
  return [
    ...routes
      .filter((route) => !ALLOWED_ROUTE_FILES.includes(route))
      .map((route) => `unexpected route file: ${route}`),
    ...ALLOWED_ROUTE_FILES.filter((route) => !routes.includes(route)).map(
      (route) => `missing route file: ${route}`,
    ),
  ];
}

/** The two places where Next.js looks for its historical Pages Router. */
export const PAGES_ROUTER_DIRECTORIES: readonly string[] = [
  "pages",
  "src/pages",
];

/**
 * 18 §5, G5 (b), 21 J1-J T-4: no Pages Router directory. Next.js would serve its `pages/api/*`
 * files as server endpoints, outside the allow-list of route files under src/app.
 */
export function findPagesRouterDirectories(frontRoot: string): string[] {
  return PAGES_ROUTER_DIRECTORIES.filter((relative) =>
    existsSync(path.join(frontRoot, relative)),
  ).map((relative) => `unexpected Pages Router directory: ${relative}/`);
}

/** Data-layer imports, Server Actions, and environment reads outside the config file. */
export function findRelayContentViolations(frontRoot: string): string[] {
  return Object.values(RELAY_FILES).flatMap((relative) => {
    const file = path.join(frontRoot, relative);
    if (!existsSync(file)) {
      return [`missing relay file: ${relative}`];
    }
    const source = readFileSync(file, "utf8");
    const findings = importSpecifiers(source)
      .filter((specifier) => DATA_LAYER_IMPORT.test(specifier))
      .map((specifier) => `${relative}: imports ${specifier}`);
    if (USE_SERVER_DIRECTIVE.test(source)) {
      findings.push(`${relative}: contains a "use server" directive`);
    }
    if (relative !== RELAY_FILES.config && PROCESS_ENV_READ.test(source)) {
      findings.push(`${relative}: reads process.env`);
    }
    return findings;
  });
}

/**
 * Guard of the importers: relay.ts is imported by route.ts only, api-client.ts by relay.ts only,
 * config/server.ts by api-client.ts only. This keeps every component of the landing page away
 * from the network (CA8).
 */
export function findRelayImporterViolations(frontRoot: string): string[] {
  const chain: ReadonlyArray<readonly [target: string, onlyImporter: string]> =
    [
      [RELAY_FILES.relay, RELAY_FILES.route],
      [RELAY_FILES.apiClient, RELAY_FILES.relay],
      [RELAY_FILES.config, RELAY_FILES.apiClient],
    ];
  const withoutExtension = (relative: string) =>
    path.join(frontRoot, relative).replace(SOURCE_FILE, "");
  const importers = new Map<string, Set<string>>(
    chain.map(([target]) => [withoutExtension(target), new Set<string>()]),
  );
  const sources = listFiles(path.join(frontRoot, "src")).filter((file) =>
    SOURCE_FILE.test(file),
  );
  for (const file of sources) {
    for (const specifier of importSpecifiers(readFileSync(file, "utf8"))) {
      const resolved = resolveLocalSpecifier(frontRoot, file, specifier);
      if (resolved !== null) {
        importers.get(resolved)?.add(relativePath(frontRoot, file));
      }
    }
  }
  return chain.flatMap(([target, onlyImporter]) => {
    const actual = [...(importers.get(withoutExtension(target)) ?? [])].sort();
    return actual.length === 1 && actual[0] === onlyImporter
      ? []
      : [
          `${target} is imported by [${actual.join(", ")}], expected ${onlyImporter} only`,
        ];
  });
}

export function sha256OfFile(file: string): string {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

/** Relay files whose SHA-256 differs from the pin. */
export function findRelayFingerprintMismatches(frontRoot: string): string[] {
  return Object.entries(RELAY_FILE_SHA256).flatMap(([relative, pinned]) => {
    const file = path.join(frontRoot, relative);
    if (!existsSync(file)) {
      return [`missing relay file: ${relative}`];
    }
    const actual = sha256OfFile(file);
    return actual === pinned
      ? []
      : [
          `${relative}: SHA-256 ${actual} differs from the pin. A relay change is a conscious ` +
            "gesture: update RELAY_FILE_SHA256 in packages/test-kit/src/guards.ts in the same " +
            "commit, and copy the file to the other front (03 PP-12).",
        ];
  });
}

/** The browser relay client, when its SHA-256 differs from the pin (or when it is missing). */
export function findBrowserRelayClientMismatches(frontRoot: string): string[] {
  const file = path.join(frontRoot, BROWSER_RELAY_CLIENT_FILE);
  if (!existsSync(file)) {
    return [`missing browser relay client: ${BROWSER_RELAY_CLIENT_FILE}`];
  }
  const actual = sha256OfFile(file);
  return actual === BROWSER_RELAY_CLIENT_SHA256
    ? []
    : [
        `${BROWSER_RELAY_CLIENT_FILE}: SHA-256 ${actual} differs from the pin. Update ` +
          "BROWSER_RELAY_CLIENT_SHA256 in the same commit and copy the file to the other front.",
      ];
}

/** Storage APIs anywhere, network APIs anywhere but in the API client and the relay client. */
export function findNetworkOrStorageUse(
  files: readonly string[],
  frontRoot: string,
): string[] {
  const allowed = [RELAY_FILES.apiClient, BROWSER_RELAY_CLIENT_FILE].map(
    (file) => path.resolve(frontRoot, file),
  );
  const outsideApiClient = files.filter(
    (file) => !allowed.includes(path.resolve(file)),
  );
  return [
    ...findMatches(STORAGE_API_PATTERN, files, frontRoot),
    ...findMatches(NETWORK_API_PATTERN, outsideApiClient, frontRoot),
  ];
}
