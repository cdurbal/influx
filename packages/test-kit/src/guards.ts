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

/** Whether a file is valid UTF-8 (a stray Latin-1 byte in a comment is invisible in review). */
export function isValidUtf8(file: string): boolean {
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(readFileSync(file));
    return true;
  } catch {
    return false;
  }
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

// Since PL-09 (arbitration PL-07, 02 §21.3 point 7) the relay, its API client and configuration,
// the browser relay client, the error collector and the hydration marker live once, in
// packages/web-platform, which keeps the src/ tree of the fronts. Only the route file stays in each
// front, a named copy: Next.js reads its runtime, dynamic and revalidate literals in the file itself.
// Paths below are relative to the root of a front (`route`) or of packages/web-platform (the rest).

/** The four relay files: the route in each front, the other three in packages/web-platform. */
export const RELAY_FILES = {
  route: "src/app/api/[...path]/route.ts",
  relay: "src/server/relay.ts",
  apiClient: "src/server/api-client.ts",
  config: "src/config/server.ts",
} as const;

/**
 * The only browser module that calls the network: the same-origin relay (21 §4, J3 commit 12).
 * In packages/web-platform and pinned, like the relay files: changing it is a conscious gesture.
 */
export const BROWSER_RELAY_CLIENT_FILE = "src/browser/relay-client.ts";
export const BROWSER_RELAY_CLIENT_SHA256 =
  "05a387cf976fa145a5ed4e3dd4c27740e1874f3fd3c2add5efbed7e5c30225dd";

/** The package of the plumbing of both fronts (arbitration PL-07). */
export const WEB_PLATFORM_PACKAGE = "@influx/web-platform";

/** The specifier by which the route files of a front, and they alone, import the relay. */
export const PLATFORM_RELAY_SPECIFIER = `${WEB_PLATFORM_PACKAGE}/relay`;

/**
 * The `exports` of packages/web-platform, frozen (arbitration PL-07 point 1): neither the API
 * client nor the configuration is exported, so that the package closes the chain route → relay →
 * API client → configuration itself. Exporting more is a commit that changes this list.
 */
export const PLATFORM_EXPORTS: Readonly<Record<string, string>> = {
  "./relay": `./${RELAY_FILES.relay}`,
  "./relay-client": `./${BROWSER_RELAY_CLIENT_FILE}`,
  "./error-collector": "./src/observability/error-collector.ts",
  "./hydration-marker": "./src/components/HydrationMarker.tsx",
};

/** The two files of packages/web-platform allowed to call the network (02 §13.2, 21 J1-C). */
export const PLATFORM_NETWORK_FILES: readonly string[] = [
  RELAY_FILES.apiClient,
  BROWSER_RELAY_CLIENT_FILE,
];

/**
 * EC-22 (02 §20.10, 21 EC-22): the public health route of apps/web, 200 or 503 with an empty body,
 * from GET /v1/status through the relay. Web only: the backoffice has none.
 */
export const HEALTH_ROUTE_FILE = "src/app/health/route.ts";

/** What a front serves beyond the relay: apps/web its health route (EC-22), the backoffice nothing. */
export type FrontRoutes = { healthRoute: boolean };

const RELAY_ONLY: FrontRoutes = { healthRoute: false };

/** Every route file allowed under src/app of a front. */
export function allowedRouteFilesOf(routes: FrontRoutes): readonly string[] {
  return routes.healthRoute
    ? [RELAY_FILES.route, HEALTH_ROUTE_FILE]
    : [RELAY_FILES.route];
}

/**
 * SHA-256 of the relay files (03 PP-12, T7.8), on the bytes where they live: the route in each
 * front, the rest in packages/web-platform. There is no Pull Request to review a change of these
 * files: changing one requires updating its pin here, in the same commit (and, for the route,
 * copying the file to the other front). That is the conscious gesture.
 */
export const RELAY_FILE_SHA256: Readonly<Record<string, string>> = {
  [RELAY_FILES.route]:
    "a79a3d1dad364cdc19058c3818a29f98a03b341469ad11c43eb2809bbe1f57d6",
  [RELAY_FILES.relay]:
    "ee32d3d1090c14ab3c9acd77e8a4b3c1ef4c437e61e2c50fcecfef805e0423c5",
  [RELAY_FILES.apiClient]:
    "36c772dca55144f0334ca40df0a51227264bcdcebae39626ad0534201d0c5985",
  [RELAY_FILES.config]:
    "7602a247f0deeb9d45569f2627ef244c0414fd45f50b406c9df2cac1dfd9b30f",
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
export function findRouteFileViolations(
  frontRoot: string,
  frontRoutes: FrontRoutes = RELAY_ONLY,
): string[] {
  const allowed = allowedRouteFilesOf(frontRoutes);
  const routes = listFiles(path.join(frontRoot, "src", "app"))
    .filter((file) => /[\\/]route\.(?:ts|tsx|js|jsx|mjs)$/.test(file))
    .map((file) => relativePath(frontRoot, file));
  return [
    ...routes
      .filter((route) => !allowed.includes(route))
      .map((route) => `unexpected route file: ${route}`),
    ...allowed
      .filter((route) => !routes.includes(route))
      .map((route) => `missing route file: ${route}`),
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

/**
 * The dynamic segments a connected-space page or route may carry (J4S-7, 21 §8 and
 * docs/mvp/archives/21-journal-lot1-archive.md l. 68): a closed list, each entry an opaque
 * identifier (UUID), never a name or a handle. The error collector sends `location.pathname` to the
 * API (`packages/web-platform/src/observability/error-collector.ts` l. 42): a name in a path would
 * reach `ops` as personal data. Extending the list is a conscious gesture, in the commit of the
 * route that needs it.
 */
export const OPAQUE_DYNAMIC_SEGMENTS: readonly string[] = ["[id]"];

/** The message of both guards of J4S-7, imposed by the milestone sheet. */
export const OPAQUE_PATH_RULE =
  "segment = identifiant opaque, ou modèle de route Next envoyé par le collecteur (`error-collector.ts` l. 42)";

const PAGE_OR_ROUTE_FILE = /^(?:page|route)\.(?:ts|tsx|js|jsx|mjs)$/;
const DYNAMIC_SEGMENT = /^\[.*\]$/;
const LITERAL_SLUG = /^[A-Za-z0-9/-]+$/;

/**
 * J4S-7 (L2AT-4): the dynamic segments that are not data, by position from the root of `src/app`:
 * the locale (a closed set, fr and en), the catch-all that answers the localized 404 (it renders
 * nothing and calls `notFound()`), and the relay route (`api/[...path]`, pinned by the route-file
 * and fingerprint guards). Exact positions, never a name: `[locale]` below another directory, or
 * the same catch-all one level deeper, is still a violation.
 */
export const WEB_STRUCTURAL_SEGMENTS: readonly string[] = [
  "[locale]",
  "[locale]/[...rest]",
  "api/[...path]",
];

/** The backoffice has the relay route only (L2AT-4). */
export const BACKOFFICE_STRUCTURAL_SEGMENTS: readonly string[] = [
  "api/[...path]",
];

/**
 * J4S-7: the pages and routes under a front's `src/app` (every tree since L2B, not only
 * `[locale]/(member)` and `(app)`) whose path holds a dynamic segment (`[x]`, `[...x]`,
 * `[[...x]]`) outside the closed list. `structural` lists, by position from the root, the segments
 * that are not data (WEB_STRUCTURAL_SEGMENTS); the closed list itself is unchanged.
 * Returns "relative/dir: [segment] (message)".
 */
export function findDynamicSegmentViolations(
  spaceRoot: string,
  allowed: readonly string[] = OPAQUE_DYNAMIC_SEGMENTS,
  structural: readonly string[] = [],
): string[] {
  if (!existsSync(spaceRoot)) {
    return [`${spaceRoot}: connected-space directory not found`];
  }
  const directories = new Set(
    listFiles(spaceRoot)
      .filter((file) => PAGE_OR_ROUTE_FILE.test(path.basename(file)))
      .map((file) => relativePath(spaceRoot, path.dirname(file))),
  );
  return [...directories].sort().flatMap((directory) =>
    directory
      .split("/")
      .filter(
        (segment, index, segments) =>
          DYNAMIC_SEGMENT.test(segment) &&
          !allowed.includes(segment) &&
          !structural.includes(segments.slice(0, index + 1).join("/")),
      )
      .map((segment) => `${directory}: ${segment} (${OPAQUE_PATH_RULE})`),
  );
}

/**
 * J4S-7: the slugs of a page table that are not a literal of letters, digits, `-` and `/`. A slug
 * built from a name, a handle or any runtime value would put it in a path.
 */
export function findNonLiteralSlugs(
  slugs: Readonly<Record<string, Readonly<Record<string, string>>>>,
): string[] {
  return Object.entries(slugs).flatMap(([page, byLocale]) =>
    Object.entries(byLocale)
      .filter(([, slug]) => !LITERAL_SLUG.test(slug))
      .map(
        ([locale, slug]) =>
          `${page}.${locale}: ${JSON.stringify(slug)} (${OPAQUE_PATH_RULE})`,
      ),
  );
}

/** A relay file and the root it lives under: the route in a front, the rest in packages/web-platform. */
function relayFileLocations(
  frontRoot: string,
  platformRoot: string,
): ReadonlyArray<readonly [root: string, relative: string]> {
  return [
    [frontRoot, RELAY_FILES.route],
    [platformRoot, RELAY_FILES.relay],
    [platformRoot, RELAY_FILES.apiClient],
    [platformRoot, RELAY_FILES.config],
  ];
}

/**
 * Data-layer imports, Server Actions, and environment reads outside the config file, in the relay
 * files (the route of the front, the rest in packages/web-platform) and in the health route of web
 * (EC-22).
 */
export function findRelayContentViolations(
  frontRoot: string,
  platformRoot: string,
  frontRoutes: FrontRoutes = RELAY_ONLY,
): string[] {
  const files: ReadonlyArray<readonly [root: string, relative: string]> = [
    ...relayFileLocations(frontRoot, platformRoot),
    ...(frontRoutes.healthRoute
      ? [[frontRoot, HEALTH_ROUTE_FILE] as const]
      : []),
  ];
  return files.flatMap(([root, relative]) => {
    const file = path.join(root, relative);
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

function sourceFilesOf(root: string): string[] {
  const sources = path.join(root, "src");
  return existsSync(sources)
    ? listFiles(sources).filter((file) => SOURCE_FILE.test(file))
    : [];
}

/** `expected` is the exact list of `actual`, in any order; otherwise one finding. */
function importerFinding(
  target: string,
  actual: readonly string[],
  expected: readonly string[],
): string[] {
  const sortedActual = [...actual].sort();
  const sortedExpected = [...expected].sort();
  if (sortedActual.join("\n") === sortedExpected.join("\n")) {
    return [];
  }
  const wanted =
    sortedExpected.length === 0 ? "none" : `${sortedExpected.join(", ")} only`;
  return [
    `${target} is imported by [${sortedActual.join(", ")}], expected ${wanted}`,
  ];
}

/**
 * Guard of the importers, along the chain route → relay → API client → configuration:
 * - in the front, `@influx/web-platform/relay` is imported by the route files only (the relay
 *   route, and the health route of web, EC-22); no file reaches packages/web-platform by a path,
 *   nor by a subpath outside its frozen `exports`;
 * - in packages/web-platform, relay.ts is imported by no file of the package, api-client.ts by
 *   relay.ts only, config/server.ts by api-client.ts only.
 * This keeps every component of the landing page away from the network (CA8).
 */
export function findRelayImporterViolations(
  frontRoot: string,
  platformRoot: string,
  frontRoutes: FrontRoutes = RELAY_ONLY,
): string[] {
  const findings: string[] = [];
  const platformDirectory = path.resolve(platformRoot) + path.sep;
  const relayImporters: string[] = [];
  for (const file of sourceFilesOf(frontRoot)) {
    const relative = relativePath(frontRoot, file);
    for (const specifier of importSpecifiers(readFileSync(file, "utf8"))) {
      if (specifier === PLATFORM_RELAY_SPECIFIER) {
        relayImporters.push(relative);
      } else if (
        specifier.startsWith(`${WEB_PLATFORM_PACKAGE}/`) &&
        !(
          `.${specifier.slice(WEB_PLATFORM_PACKAGE.length)}` in PLATFORM_EXPORTS
        )
      ) {
        findings.push(`${relative}: imports ${specifier}, not an export`);
      }
      const resolved = resolveLocalSpecifier(frontRoot, file, specifier);
      if (
        resolved !== null &&
        path.resolve(resolved).startsWith(platformDirectory)
      ) {
        findings.push(
          `${relative}: imports packages/web-platform by a path (${specifier})`,
        );
      }
    }
  }
  findings.push(
    ...importerFinding(
      PLATFORM_RELAY_SPECIFIER,
      relayImporters,
      allowedRouteFilesOf(frontRoutes),
    ),
  );
  const chain: ReadonlyArray<
    readonly [target: string, onlyImporters: readonly string[]]
  > = [
    [RELAY_FILES.relay, []],
    [RELAY_FILES.apiClient, [RELAY_FILES.relay]],
    [RELAY_FILES.config, [RELAY_FILES.apiClient]],
  ];
  const withoutExtension = (relative: string) =>
    path.join(platformRoot, relative).replace(SOURCE_FILE, "");
  const importers = new Map<string, Set<string>>(
    chain.map(([target]) => [withoutExtension(target), new Set<string>()]),
  );
  for (const file of sourceFilesOf(platformRoot)) {
    for (const specifier of importSpecifiers(readFileSync(file, "utf8"))) {
      const resolved = resolveLocalSpecifier(platformRoot, file, specifier);
      if (resolved !== null) {
        importers.get(resolved)?.add(relativePath(platformRoot, file));
      }
    }
  }
  return [
    ...findings,
    ...chain.flatMap(([target, onlyImporters]) =>
      importerFinding(
        target,
        [...(importers.get(withoutExtension(target)) ?? [])],
        onlyImporters,
      ),
    ),
  ];
}

export function sha256OfFile(file: string): string {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

/** Relay files whose SHA-256 differs from the pin: the route of the front, the rest in the package. */
export function findRelayFingerprintMismatches(
  frontRoot: string,
  platformRoot: string,
): string[] {
  return relayFileLocations(frontRoot, platformRoot).flatMap(
    ([root, relative]) => {
      const file = path.join(root, relative);
      if (!existsSync(file)) {
        return [`missing relay file: ${relative}`];
      }
      const actual = sha256OfFile(file);
      const copy =
        relative === RELAY_FILES.route
          ? ", and copy the route file to the other front"
          : "";
      return actual === RELAY_FILE_SHA256[relative]
        ? []
        : [
            `${relative}: SHA-256 ${actual} differs from the pin. A relay change is a conscious ` +
              "gesture: update RELAY_FILE_SHA256 in packages/test-kit/src/guards.ts in the same " +
              `commit${copy} (03 PP-12).`,
          ];
    },
  );
}

/** The browser relay client of packages/web-platform, when its SHA-256 differs from the pin or it is missing. */
export function findBrowserRelayClientMismatches(
  platformRoot: string,
): string[] {
  const file = path.join(platformRoot, BROWSER_RELAY_CLIENT_FILE);
  if (!existsSync(file)) {
    return [`missing browser relay client: ${BROWSER_RELAY_CLIENT_FILE}`];
  }
  const actual = sha256OfFile(file);
  return actual === BROWSER_RELAY_CLIENT_SHA256
    ? []
    : [
        `${BROWSER_RELAY_CLIENT_FILE}: SHA-256 ${actual} differs from the pin. Update ` +
          "BROWSER_RELAY_CLIENT_SHA256 in packages/test-kit/src/guards.ts in the same commit.",
      ];
}

/**
 * What a front keeps of the files of packages/web-platform (arbitration PL-07 point 6): a file at
 * the same path under the front, or a file with the same bytes anywhere under its src/ (apps/web
 * held the hydration marker under src/components/ui/). The identity guard of the copies became
 * this absence guard, one for one; the route file is not in the package.
 */
export function findPlatformFileCopies(
  frontRoot: string,
  platformRoot: string,
): string[] {
  const platformFiles = listFiles(path.join(platformRoot, "src"));
  const samePath = platformFiles
    .map((file) => relativePath(platformRoot, file))
    .filter((relative) => existsSync(path.join(frontRoot, relative)))
    .map((relative) => `${relative}: copy of a file of packages/web-platform`);
  const fingerprints = new Map(
    platformFiles.map((file) => [
      sha256OfFile(file),
      relativePath(platformRoot, file),
    ]),
  );
  const frontSources = path.join(frontRoot, "src");
  const sameBytes = (
    existsSync(frontSources) ? listFiles(frontSources) : []
  ).flatMap((file) => {
    const twin = fingerprints.get(sha256OfFile(file));
    const relative = relativePath(frontRoot, file);
    return twin === undefined || twin === relative
      ? []
      : [`${relative}: identical to packages/web-platform/${twin}`];
  });
  return [...samePath, ...sameBytes];
}

/** The name and the `exports` of packages/web-platform, when they differ from PLATFORM_EXPORTS. */
export function findPlatformExportViolations(platformRoot: string): string[] {
  const manifest = JSON.parse(
    readFileSync(path.join(platformRoot, "package.json"), "utf8"),
  ) as { name?: unknown; exports?: unknown };
  const findings: string[] =
    manifest.name === WEB_PLATFORM_PACKAGE
      ? []
      : [`package.json: name is not ${WEB_PLATFORM_PACKAGE}`];
  const actual =
    typeof manifest.exports === "object" && manifest.exports !== null
      ? (manifest.exports as Record<string, unknown>)
      : {};
  const names = new Set([
    ...Object.keys(actual),
    ...Object.keys(PLATFORM_EXPORTS),
  ]);
  for (const name of [...names].sort()) {
    if (actual[name] !== PLATFORM_EXPORTS[name]) {
      findings.push(
        `package.json: export ${name} is ${JSON.stringify(actual[name])}, expected ${JSON.stringify(PLATFORM_EXPORTS[name])}`,
      );
    }
  }
  return findings;
}

/**
 * Storage APIs anywhere, network APIs anywhere but in the given files, relative to the root. A
 * front gives none since PL-09; packages/web-platform gives PLATFORM_NETWORK_FILES.
 */
export function findNetworkOrStorageUse(
  files: readonly string[],
  root: string,
  networkFiles: readonly string[] = [],
): string[] {
  const allowed = networkFiles.map((file) => path.resolve(root, file));
  const outsideNetworkFiles = files.filter(
    (file) => !allowed.includes(path.resolve(file)),
  );
  return [
    ...findMatches(STORAGE_API_PATTERN, files, root),
    ...findMatches(NETWORK_API_PATTERN, outsideNetworkFiles, root),
  ];
}

/** The red "danger" tokens of D72, docs/mvp/decisions.md §5, opaque and identical in both fronts. */
export const DANGER_RED_TOKENS = [
  "--color-feedback-error-text",
  "--color-feedback-error-icon",
  "--color-feedback-error-border",
  "--color-feedback-error-bg",
  "--color-border-error",
  "--color-action-danger-bg",
  "--color-action-danger-bg-hover",
  "--color-action-danger-bg-active",
  "--color-text-on-danger",
  "--color-decorative-progress",
] as const;

/** The value of a custom property in a token file, or null. */
export function tokenValue(css: string, name: string): string | null {
  const match = new RegExp(`${name}\\s*:\\s*([^;]+);`).exec(css);
  return match?.[1] === undefined ? null : match[1].trim();
}

/** A token that carries no alpha channel: a 6-digit hex, `transparent` or a `var()`. */
export const OPAQUE_TOKEN_VALUE =
  /^(?:#[0-9a-fA-F]{6}|transparent|var\([^)]+\))$/;

/** WCAG 2.x contrast ratio of two 6-digit hex colors. */
export function contrastRatio(foreground: string, background: string): number {
  const luminance = (hex: string): number => {
    const channels = [1, 3, 5].map((start) => {
      const value = Number.parseInt(hex.slice(start, start + 2), 16) / 255;
      return value <= 0.03928
        ? value / 12.92
        : ((value + 0.055) / 1.055) ** 2.4;
    });
    return (
      0.2126 * (channels[0] ?? 0) +
      0.7152 * (channels[1] ?? 0) +
      0.0722 * (channels[2] ?? 0)
    );
  };
  const [light, dark] = [luminance(foreground), luminance(background)].sort(
    (a, b) => b - a,
  );
  return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05);
}

/** A class that tints a red family with an opacity modifier (`bg-feedback-error-bg/40`). */
export const TRANSLUCENT_RED_CLASS = /\b[\w:-]*-(?:error|danger)-[\w-]*\/\d+/;

// ---------------------------------------------------------------------------------------------
// Token readers per charter, DS milestone (D73; 02 §21.3, §21.6; 18 §5.1, TD1)
// ---------------------------------------------------------------------------------------------
// tokenValue above reads the first occurrence in the file: it would read the vitrine and leave
// the KEO block unchecked while staying green. Every per-charter check reads effectiveTokens.

/** The two charters of a tokens.css: the vitrine (D6, D59) and KEO Emerald (D73). */
export type Charter = "vitrine" | "keo";

/** One declaration of a CSS block, its value with whitespace collapsed. */
export type CssDeclaration = { name: string; value: string };

/** A CSS block: its prelude ("" at the top level), its own declarations and its nested blocks. */
export type CssBlock = {
  prelude: string;
  declarations: CssDeclaration[];
  blocks: CssBlock[];
};

/** The selector of the KEO block (02 §21.3 point 2), quotes optional. */
const KEO_SELECTOR = /^\[data-theme=(?:"keo"|'keo'|keo)\]$/;

function collapse(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * The block tree of a stylesheet. Comments are dropped first (a brace or a `--x:` in a comment is
 * not CSS); a `;` or a brace inside parentheses or quotes does not split (`url(data:…;base64)`).
 */
export function parseCssBlocks(css: string): CssBlock {
  const source = css.replace(/\/\*[\s\S]*?\*\//g, " ");
  let index = 0;
  const parseBody = (prelude: string): CssBlock => {
    const block: CssBlock = { prelude, declarations: [], blocks: [] };
    let buffer = "";
    let depth = 0;
    let quote: string | null = null;
    const flush = () => {
      const match = /^\s*(-{0,2}[\w*-]+)\s*:([\s\S]*)$/.exec(buffer);
      if (match?.[1] !== undefined && match[2] !== undefined) {
        block.declarations.push({ name: match[1], value: collapse(match[2]) });
      }
      buffer = "";
    };
    while (index < source.length) {
      const char = source[index] ?? "";
      index += 1;
      if (quote !== null) {
        if (char === quote) quote = null;
        buffer += char;
      } else if (char === '"' || char === "'") {
        quote = char;
        buffer += char;
      } else if (char === "(") {
        depth += 1;
        buffer += char;
      } else if (char === ")") {
        depth -= 1;
        buffer += char;
      } else if (depth === 0 && char === ";") {
        flush();
      } else if (depth === 0 && char === "{") {
        const childPrelude = collapse(buffer);
        buffer = "";
        block.blocks.push(parseBody(childPrelude));
      } else if (depth === 0 && char === "}") {
        flush();
        return block;
      } else {
        buffer += char;
      }
    }
    flush();
    return block;
  };
  return parseBody("");
}

/** Every KEO block of a stylesheet, at any depth (inside `@layer base` or not). */
export function keoBlocks(css: string): CssBlock[] {
  const visit = (block: CssBlock): CssBlock[] =>
    block.blocks.flatMap((child) =>
      KEO_SELECTOR.test(child.prelude) ? [child] : visit(child),
    );
  return visit(parseCssBlocks(css));
}

/** The custom properties of a list of declarations; the reset `--*: initial` is not a token. */
function customProperties(
  declarations: readonly CssDeclaration[],
): Map<string, string> {
  return new Map(
    declarations
      .filter(({ name }) => name.startsWith("--") && !name.includes("*"))
      .map(({ name, value }) => [name, value]),
  );
}

/**
 * The three scopes a token is read from: the top-level `@theme` blocks, the top-level `:root`
 * rules (never those of an `@media`: base values only), and the KEO block. Two KEO blocks are an
 * error: which one would win is a matter of order, not of intent.
 */
export function tokenScopes(css: string): {
  theme: Map<string, string>;
  root: Map<string, string>;
  keo: Map<string, string> | null;
} {
  const top = parseCssBlocks(css).blocks;
  const of = (test: (prelude: string) => boolean) =>
    customProperties(
      top
        .filter((block) => test(block.prelude))
        .flatMap((block) => block.declarations),
    );
  const keo = keoBlocks(css);
  if (keo.length > 1) {
    throw new Error(`${keo.length} KEO blocks: exactly one is allowed`);
  }
  return {
    theme: of((prelude) => /^@theme\b/.test(prelude)),
    root: of((prelude) =>
      prelude.split(",").some((selector) => selector.trim() === ":root"),
    ),
    keo: keo[0] === undefined ? null : customProperties(keo[0].declarations),
  };
}

/** `var(--name)` or `var(--name, fallback)`: group 1 is the name. */
const VAR_REFERENCE = /var\(\s*(--[\w-]+)\s*(?:,[^()]*)?\)/g;

/** The custom properties a value refers to, in order. */
export function varReferences(value: string): string[] {
  return [...value.matchAll(VAR_REFERENCE)].flatMap((match) =>
    match[1] === undefined ? [] : [match[1]],
  );
}

/**
 * The value of every token under a charter, aliases followed (02 §21.3; 18 §5.1, TD1.2): the KEO
 * block, else `@theme`, else `:root`, for the name and for every `var()` it refers to. This is the
 * value the charter means; the closure guard (findAliasClosureGaps) proves the browser computes
 * it. A cycle, a missing target, or a KEO charter without its block is an error, never a guess.
 */
export function effectiveTokens(
  css: string,
  charter: Charter,
): Map<string, string> {
  const { theme, root, keo } = tokenScopes(css);
  if (charter === "keo" && keo === null) {
    throw new Error("no KEO block: the KEO charter cannot be read");
  }
  const raw = (name: string): string | undefined =>
    (charter === "keo" ? keo?.get(name) : undefined) ??
    theme.get(name) ??
    root.get(name);
  const resolved = new Map<string, string>();
  const resolve = (name: string, chain: readonly string[]): string => {
    const known = resolved.get(name);
    if (known !== undefined) return known;
    if (chain.includes(name)) {
      throw new Error(`alias cycle: ${[...chain, name].join(" -> ")}`);
    }
    const value = raw(name);
    if (value === undefined) {
      throw new Error(
        `missing alias target: ${chain.at(-1) ?? "?"} refers to ${name}`,
      );
    }
    const result = value.replace(VAR_REFERENCE, (_whole, target: string) =>
      resolve(target, [...chain, name]),
    );
    resolved.set(name, result);
    return result;
  };
  const names = new Set([
    ...theme.keys(),
    ...root.keys(),
    ...(keo?.keys() ?? []),
  ]);
  for (const name of names) {
    resolve(name, []);
  }
  return resolved;
}

/**
 * The aliases the browser would leave on their vitrine value under KEO (02 §21.3 point 3; G3c,
 * TD1.3). Tailwind emits @theme in `:root`: an alias is resolved there and inherited resolved, so
 * an alias whose target (direct or transitive, `calc(var(…))` included) is redefined in the KEO
 * block must be redeclared in it, identically. Redeclared towards another target is a finding; a
 * literal value is a redefinition, not an alias, and is accepted. So is an alias declared in the
 * KEO block for a token that is a literal in the vitrine (20 §11.3: `brand-accent` is the vitrine's
 * own green there and an alias of `brand-primary` under KEO). A token of `vitrineOnly` (VITRINE_ONLY)
 * is not consumable under KEO (G8): its stale resolution is no gap. A token of `retargeted`
 * (KEO_RETARGETED) may be redeclared towards another target; listed but not retargeted is stale.
 */
export function findAliasClosureGaps(
  css: string,
  vitrineOnly: readonly string[] = [],
  retargeted: readonly string[] = [],
): string[] {
  const { theme, root, keo } = tokenScopes(css);
  if (keo === null) return [];
  const vitrine = (name: string) => theme.get(name) ?? root.get(name);
  const targetsOf = (name: string, seen = new Set<string>()): Set<string> => {
    for (const target of varReferences(vitrine(name) ?? "")) {
      if (!seen.has(target)) {
        seen.add(target);
        targetsOf(target, seen);
      }
    }
    return seen;
  };
  const names = new Set([...theme.keys(), ...root.keys()]);
  const isRetargeted = (name: string): boolean => {
    const ownValue = vitrine(name) ?? "";
    const keoValue = keo.get(name) ?? ownValue;
    return (
      varReferences(ownValue).length > 0 &&
      varReferences(keoValue).length > 0 &&
      keoValue !== ownValue
    );
  };
  const stale = retargeted
    .filter((name) => !isRetargeted(name))
    .map(
      (name) =>
        `KEO_RETARGETED: stale entry ${name}, not an alias redeclared towards another target`,
    );
  return [
    ...stale,
    ...[...names].flatMap((name) => {
      if (vitrineOnly.includes(name)) return [];
      if (retargeted.includes(name)) return [];
      const ownValue = vitrine(name) ?? "";
      const redefinedTargets = [...targetsOf(name)].filter((target) =>
        keo.has(target),
      );
      const keoValue = keo.get(name);
      if (keoValue === undefined) {
        return redefinedTargets.length === 0
          ? []
          : [
              `${name}: alias of ${redefinedTargets.join(", ")}, redefined in the KEO block, ` +
                "but not redeclared there (it would keep its vitrine value)",
            ];
      }
      return isRetargeted(name)
        ? [
            `${name}: redeclared in the KEO block as "${keoValue}", another target than "${ownValue}"`,
          ]
        : [];
    }),
  ];
}

/**
 * What the KEO block of a tokens.css must not contain (G3c; TD1.1, TD1.5, TD1.6): `!important`, a
 * `--color-*` that is not opaque (`rgba(`, `color-mix(`…), a name that neither `@theme` nor `:root`
 * declares (a typo creates no class), a nested block, a vitrine `--color-*` that the block neither
 * redefines nor lists in `inherits` (KEO_INHERITS) or `vitrineOnly` (VITRINE_ONLY), and a stale
 * list entry. Anything but exactly one block is a finding.
 */
export function findKeoBlockViolations(
  css: string,
  lists: { inherits: readonly string[]; vitrineOnly: readonly string[] },
): string[] {
  const blocks = keoBlocks(css);
  const block = blocks[0];
  if (blocks.length !== 1 || block === undefined) {
    return [`${blocks.length} KEO blocks: exactly one is expected`];
  }
  const { theme, root } = tokenScopes(css);
  const redefined = customProperties(block.declarations);
  const findings: string[] = [];
  for (const { name, value } of block.declarations) {
    if (/!\s*important/i.test(value)) {
      findings.push(`${name}: !important in the KEO block`);
    }
    if (name.startsWith("--") && !theme.has(name) && !root.has(name)) {
      findings.push(`${name}: declared neither in @theme nor in :root`);
    }
    if (
      name.startsWith("--color-") &&
      !OPAQUE_TOKEN_VALUE.test(value.replace(/\s*!\s*important$/i, ""))
    ) {
      findings.push(`${name}: "${value}" is not an opaque value`);
    }
  }
  if (block.blocks.length > 0) {
    findings.push("the KEO block nests other blocks");
  }
  const colors = [...theme.keys()].filter((name) =>
    name.startsWith("--color-"),
  );
  for (const name of colors) {
    const listed = [lists.inherits, lists.vitrineOnly].filter((list) =>
      list.includes(name),
    ).length;
    if (!redefined.has(name) && listed === 0) {
      findings.push(
        `${name}: neither redefined in the KEO block, nor in KEO_INHERITS, nor in VITRINE_ONLY`,
      );
    }
    if (listed > 1) {
      findings.push(`${name}: in both KEO_INHERITS and VITRINE_ONLY`);
    }
  }
  for (const [listName, list] of [
    ["KEO_INHERITS", lists.inherits],
    ["VITRINE_ONLY", lists.vitrineOnly],
  ] as const) {
    for (const name of list) {
      if (!colors.includes(name)) {
        findings.push(
          `${listName}: stale entry ${name}, not a --color-* of @theme`,
        );
      } else if (redefined.has(name)) {
        findings.push(
          `${listName}: stale entry ${name}, redefined in the KEO block`,
        );
      }
    }
  }
  return findings;
}

/** Files other than the allowed one that hold a KEO block (G3c, TD1.1). */
export function findKeoBlocksOutside(
  cssFiles: readonly string[],
  allowedFile: string,
  root: string,
): string[] {
  return cssFiles
    .filter((file) => path.resolve(file) !== path.resolve(allowedFile))
    .filter((file) => keoBlocks(readFileSync(file, "utf8")).length > 0)
    .map((file) => `${relativePath(root, file)}: holds a KEO block`);
}

/** HSL hue of a 6-digit hex color, in degrees [0, 360); a gray has no hue and is refused. */
export function hueOf(hex: string): number {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) {
    throw new Error(`not a 6-digit hex color: ${hex}`);
  }
  const [red = 0, green = 0, blue = 0] = [1, 3, 5].map(
    (start) => Number.parseInt(hex.slice(start, start + 2), 16) / 255,
  );
  const max = Math.max(red, green, blue);
  const delta = max - Math.min(red, green, blue);
  if (delta === 0) {
    throw new Error(`${hex} is a gray: it has no hue`);
  }
  const sector =
    max === red
      ? (green - blue) / delta
      : max === green
        ? (blue - red) / delta + 2
        : (red - green) / delta + 4;
  return (sector * 60 + 360) % 360;
}

/** Shortest distance between two hues, in degrees [0, 180]: 350° and 10° are 20° apart. */
export function hueDistance(first: number, second: number): number {
  const gap = Math.abs(first - second) % 360;
  return gap > 180 ? 360 - gap : gap;
}

/** HSL hue gap of two 6-digit hex colors, in degrees (G3d; 20 §11.3). */
export function hueGap(first: string, second: string): number {
  return hueDistance(hueOf(first), hueOf(second));
}

/** Whether two colors are at least `minDegrees` apart: the threshold is data, never written here. */
export function meetsHueGap(
  first: string,
  second: string,
  minDegrees: number,
): boolean {
  return hueGap(first, second) >= minDegrees;
}

/** A pair of tokens checked under a charter (G3d): a contrast ratio or a hue gap, and its floor. */
export type TokenPair =
  | { kind: "contrast"; foreground: string; background: string; min: number }
  | { kind: "hue"; first: string; second: string; min: number };

/**
 * The pairs that miss their floor in a set of effective tokens (G3d; TD1.8): the guard computes,
 * the data (pairs and floors, 20 §11.4) decides. A token missing from the set is a finding.
 */
export function findTokenPairFailures(
  tokens: ReadonlyMap<string, string>,
  pairs: readonly TokenPair[],
): string[] {
  return pairs.flatMap((pair) => {
    const [first, second] =
      pair.kind === "contrast"
        ? [pair.foreground, pair.background]
        : [pair.first, pair.second];
    const a = tokens.get(first);
    const b = tokens.get(second);
    if (a === undefined || b === undefined) {
      return [`${first} / ${second}: token missing`];
    }
    const measured =
      pair.kind === "contrast" ? contrastRatio(a, b) : hueGap(a, b);
    return measured >= pair.min
      ? []
      : [
          `${first} (${a}) / ${second} (${b}): ${pair.kind} ${measured.toFixed(2)} under ${pair.min}`,
        ];
  });
}

const COLOR_MIX_OVER_TRANSPARENT =
  /color-mix\(\s*in srgb\s*,\s*(#[0-9a-fA-F]{6})\s+(\d+(?:\.\d+)?)%\s*,\s*transparent\s*\)/;

/**
 * The effective tokens plus one derived color, `name`: the peak of the header glow, i.e. the brand
 * green of its `color-mix(… N%, transparent)` laid over the page (RK-9; 20 §11.4). The percentage
 * is read from the stylesheet, so a stronger glow moves the pairs checked against it. Nothing is
 * declared: the color exists only here, for G3d. A glow with no such mix is a finding (it throws).
 */
export function withGlowPeak(
  tokens: ReadonlyMap<string, string>,
  name: string,
): Map<string, string> {
  const mix = COLOR_MIX_OVER_TRANSPARENT.exec(
    tokens.get("--background-image-header-glow") ?? "",
  );
  const page = tokens.get("--color-surface-page");
  if (mix === null || page === undefined) {
    throw new Error("no header glow made of a color-mix over the page");
  }
  const share = Number(mix[2]) / 100;
  const channel = (hex: string, start: number): number =>
    Number.parseInt(hex.slice(start, start + 2), 16);
  const peak = [1, 3, 5]
    .map((start) =>
      Math.round(
        channel(mix[1] ?? "", start) * share +
          channel(page, start) * (1 - share),
      )
        .toString(16)
        .padStart(2, "0"),
    )
    .join("");
  return new Map([...tokens, [name, `#${peak}`]]);
}

// ---------------------------------------------------------------------------------------------
// G3e: the vitrine frozen (D59; 18 §5.1, TD4.1)
// ---------------------------------------------------------------------------------------------

/**
 * Every declaration of a tokens.css outside the KEO block, by block path ("@theme static",
 * "@media (width >= 768px) > :root", "@theme static > @keyframes marquee > from"): what the
 * snapshot of G3e freezes.
 */
export function vitrineDeclarations(
  css: string,
): Record<string, Record<string, string>> {
  const scopes: Record<string, Record<string, string>> = {};
  const visit = (block: CssBlock, trail: readonly string[]) => {
    for (const child of block.blocks) {
      if (KEO_SELECTOR.test(child.prelude)) continue;
      const childTrail = [...trail, child.prelude];
      if (child.declarations.length > 0) {
        const scope = (scopes[childTrail.join(" > ")] ??= {});
        for (const { name, value } of child.declarations) {
          scope[name] = value;
        }
      }
      visit(child, childTrail);
    }
  };
  visit(parseCssBlocks(css), []);
  return scopes;
}

/** Declarations of the snapshot that changed or disappeared; additions are allowed (G3e). */
export function findVitrineSnapshotChanges(
  snapshot: Readonly<Record<string, Readonly<Record<string, string>>>>,
  css: string,
): string[] {
  const current = vitrineDeclarations(css);
  return Object.entries(snapshot).flatMap(([scope, declarations]) =>
    Object.entries(declarations).flatMap(([name, value]) => {
      const now = current[scope]?.[name];
      if (now === value) return [];
      return [
        now === undefined
          ? `${scope} ${name}: removed (was "${value}")`
          : `${scope} ${name}: "${value}" became "${now}"`,
      ];
    }),
  );
}

// ---------------------------------------------------------------------------------------------
// G3f: the backoffice-only tokens (D73; 18 §5.1, 02 §21.3 point 6)
// ---------------------------------------------------------------------------------------------

/** The marker of a backoffice-only token name: `--spacing-bo-row-h`, `--color-bo-sla-…`. */
export const BO_TOKEN_MARKER = /-bo-/;

/**
 * Custom properties of tokens-backoffice.css whose name carries no `-bo-` marker: the file holds
 * the `--*-bo-*` tokens of the backoffice and nothing else (a plain name would leak into the shared
 * vocabulary of tokens.css).
 */
export function findNonBoDeclarations(css: string): string[] {
  const names: string[] = [];
  const visit = (block: CssBlock) => {
    for (const { name } of block.declarations) {
      if (name.startsWith("--") && !name.includes("*")) names.push(name);
    }
    block.blocks.forEach(visit);
  };
  visit(parseCssBlocks(css));
  return names
    .filter((name) => !BO_TOKEN_MARKER.test(name))
    .map((name) => `${name}: no "-bo-" marker in tokens-backoffice.css`);
}

// ---------------------------------------------------------------------------------------------
// G4f: self-hosted fonts (D73; 18 §5.1, TD1.9, 02 §21.4)
// ---------------------------------------------------------------------------------------------

// Since PL-08 (arbitration PL-07, 02 §21.3 point 7) the fonts, their manifest, fonts.ts and
// tokens.css live once, in packages/ui; the paths below are relative to the root of that package.
// The fronts hold none of them (findCharterFileCopies) and import them by package name.

export const FONTS_DIRECTORY = "src/styles/fonts";
export const FONTS_MANIFEST = `${FONTS_DIRECTORY}/FONTS.md`;
export const FONTS_MODULE = "src/styles/fonts.ts";
/** The tokens of the package, relative to its root. */
export const TOKENS_MODULE = "src/styles/tokens.css";

/** The specifier by which a front imports the tokens (its globals.css only). */
export const UI_TOKENS_SPECIFIER = "@influx/ui/tokens.css";
/** The specifier by which a front imports the font classes (its KEO layout only, G8). */
export const UI_FONTS_SPECIFIER = "@influx/ui/fonts";

/** Ceiling of the bytes preloaded by a page: the two `latin` files (02 §21.4 point 6). */
export const FONT_PRELOAD_CEILING_BYTES = 120_000;

/** Measured at DS-3 (24 836 + 28 872) and frozen: changing a font is a commit that moves this. */
export const FONT_PRELOAD_PINNED_BYTES = 53_708;

export type FontManifestRow = {
  file: string;
  subset: string;
  sha256: string;
  preloaded: boolean;
  license: string;
};

/** Rows of the manifest table: the cells that hold a backticked `.woff2` file name. */
export function parseFontManifest(markdown: string): FontManifestRow[] {
  return markdown.split(/\r?\n/).flatMap((line) => {
    const cells = line.split("|").map((cell) => cell.trim().replace(/`/g, ""));
    // | file | family | subset | source | sha256 | weights | preloaded | license |
    const [, file, , subset, , sha256, , preloaded, license] = cells;
    return file?.endsWith(".woff2")
      ? [
          {
            file,
            subset: subset ?? "",
            sha256: sha256 ?? "",
            preloaded: preloaded === "yes",
            license: license ?? "",
          },
        ]
      : [];
  });
}

/**
 * Font violations of the package that holds the fonts (packages/ui): a woff2 outside
 * `src/styles/fonts/`, a file missing from the manifest or listed without being there, a SHA-256 or
 * a `wOF2` signature that is wrong, a missing OFL text, a preload budget over the ceiling or off
 * the pin.
 */
export function findFontViolations(packageRoot: string): string[] {
  const violations: string[] = [];
  const fontsDirectory = path.join(packageRoot, FONTS_DIRECTORY);
  const sources = ["src", "public"]
    .map((directory) => path.join(packageRoot, directory))
    .filter((directory) => existsSync(directory));
  const woff2Files = sources
    .flatMap(listFiles)
    .filter((file) => /\.woff2?$/i.test(file));
  for (const file of woff2Files) {
    if (path.dirname(path.resolve(file)) !== path.resolve(fontsDirectory)) {
      violations.push(
        `${relativePath(packageRoot, file)}: font outside ${FONTS_DIRECTORY}/`,
      );
    }
  }
  const manifestFile = path.join(packageRoot, FONTS_MANIFEST);
  if (!existsSync(manifestFile)) {
    return [...violations, `missing manifest: ${FONTS_MANIFEST}`];
  }
  const rows = parseFontManifest(readFileSync(manifestFile, "utf8"));
  const listed = new Set(rows.map((row) => row.file));
  for (const file of woff2Files) {
    const name = path.basename(file);
    if (
      !listed.has(name) &&
      path.dirname(path.resolve(file)) === path.resolve(fontsDirectory)
    ) {
      violations.push(`${name}: not listed in ${FONTS_MANIFEST}`);
    }
  }
  let preloadedBytes = 0;
  for (const row of rows) {
    const file = path.join(fontsDirectory, row.file);
    if (!existsSync(file)) {
      violations.push(
        `${row.file}: listed in the manifest, absent from ${FONTS_DIRECTORY}/`,
      );
      continue;
    }
    const bytes = readFileSync(file);
    if (bytes.subarray(0, 4).toString("latin1") !== "wOF2") {
      violations.push(`${row.file}: not a woff2 file (signature is not wOF2)`);
    }
    if (sha256OfFile(file) !== row.sha256) {
      violations.push(
        `${row.file}: SHA-256 differs from the manifest (fonts are never modified)`,
      );
    }
    if (!existsSync(path.join(fontsDirectory, row.license))) {
      violations.push(`${row.file}: license file ${row.license} is absent`);
    } else if (
      !/SIL OPEN FONT LICENSE Version 1\.1/.test(
        readFileSync(path.join(fontsDirectory, row.license), "utf8"),
      )
    ) {
      violations.push(`${row.license}: not the SIL Open Font License 1.1`);
    }
    if (row.preloaded) preloadedBytes += bytes.length;
  }
  if (preloadedBytes > FONT_PRELOAD_CEILING_BYTES) {
    violations.push(
      `preloaded fonts weigh ${preloadedBytes} bytes, over the ${FONT_PRELOAD_CEILING_BYTES} ceiling`,
    );
  }
  if (preloadedBytes !== FONT_PRELOAD_PINNED_BYTES) {
    violations.push(
      `preloaded fonts weigh ${preloadedBytes} bytes, the pin is ${FONT_PRELOAD_PINNED_BYTES} ` +
        "(update FONT_PRELOAD_PINNED_BYTES in the same commit)",
    );
  }
  return violations;
}

/**
 * What a front keeps of the charter files that live in packages/ui (arbitration PL-07): its own
 * `src/styles/tokens.css`, `src/styles/fonts.ts` or `src/styles/fonts/`, and any font file under
 * `src/` or `public/`. The identity guard of the copies became this absence guard, one for one.
 */
export function findCharterFileCopies(frontRoot: string): string[] {
  const violations = [TOKENS_MODULE, FONTS_MODULE, FONTS_DIRECTORY]
    .filter((relative) => existsSync(path.join(frontRoot, relative)))
    .map((relative) => `${relative}: copy of a file of packages/ui`);
  const fontFiles = ["src", "public"]
    .map((directory) => path.join(frontRoot, directory))
    .filter((directory) => existsSync(directory))
    .flatMap(listFiles)
    .filter((file) => /\.woff2?$/i.test(file))
    .map(
      (file) =>
        `${relativePath(frontRoot, file)}: font file in a front (packages/ui holds them)`,
    );
  return [...violations, ...fontFiles];
}

/**
 * The style sheets of a front that import the tokens of packages/ui (`@import "@influx/ui/tokens.css"`),
 * compared with the given sheets: each globals.css imports them, no other sheet does (02 §21.3 point 3).
 */
export function findTokensImportViolations(
  frontRoot: string,
  sheets: readonly string[],
): string[] {
  const sourcesDirectory = path.join(frontRoot, "src");
  const importers = listFiles(sourcesDirectory)
    .filter((file) => file.endsWith(".css"))
    .filter((file) =>
      readFileSync(file, "utf8").includes(`@import "${UI_TOKENS_SPECIFIER}"`),
    )
    .map((file) => relativePath(frontRoot, file));
  return exactSetFinding(
    `${UI_TOKENS_SPECIFIER} is imported`,
    importers,
    sheets,
  );
}

// ---------------------------------------------------------------------------------------------
// G8: the two charters of a front kept apart (D73; 02 §21.3 to §21.6; 18 §5.1, TD1.10)
// ---------------------------------------------------------------------------------------------

/** The attribute that turns the KEO charter on (02 §21.3 point 4). */
export const KEO_ATTRIBUTE_PATTERN = /\bdata-theme\b/;

/** A portal renders outside the KEO container, which its content would leave (02 §21.3 point 5). */
export const PORTAL_PATTERN = /\bcreatePortal\b/;

/**
 * A transformation on a state (hover, active, focus, group or peer). KEO keeps the zoom and the lift
 * the founder asked for (F6, 2026-10-29), but under `motion-safe:` only: the same class without
 * that variant is refused (20 §11.5; 02 §21.5 point 7). A static transform is no state. The two
 * capture groups are the variants before and after the state, where `motion-safe:` may stand.
 */
export const STATE_TRANSFORM_PATTERN =
  /(?<![\w-])((?:[\w-]+:)*)(?:hover|active|focus|focus-visible|focus-within|group-hover|group-focus|peer-hover|peer-focus):((?:[\w-]+:)*)-?(?:scale|translate|rotate|skew)(?!\w)/g;

/** `transition-all` moves every property, layout included: refused everywhere (20 §11.5). */
export const TRANSITION_ALL_PATTERN = /\btransition-all\b/;

/** A line with a state transformation that is not under `motion-safe:`, or `transition-all`. */
export function hasUnsafeStateTransform(line: string): boolean {
  if (TRANSITION_ALL_PATTERN.test(line)) return true;
  return [...line.matchAll(STATE_TRANSFORM_PATTERN)].some(
    (match) => !`${match[1] ?? ""}${match[2] ?? ""}`.includes("motion-safe:"),
  );
}

/** A source without its comments, which may name what the code must not do. */
function withoutComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

/** The source files (.ts, .tsx…) under src/ of a front, or under the given folders of it. */
function sourceFilesUnder(
  frontRoot: string,
  folders: readonly string[] = ["src"],
): string[] {
  return folders.flatMap((folder) => {
    const directory = path.join(frontRoot, folder);
    return existsSync(directory)
      ? listFiles(directory).filter((file) => SOURCE_FILE.test(file))
      : [];
  });
}

/** "… in [a, b], expected [c]" when the two sets differ; nothing otherwise. */
function exactSetFinding(
  subject: string,
  actual: readonly string[],
  expected: readonly string[],
): string[] {
  const found = [...new Set(actual)].sort();
  const wanted = [...new Set(expected)].sort();
  return found.join("\n") === wanted.join("\n")
    ? []
    : [`${subject} in [${found.join(", ")}], expected [${wanted.join(", ")}]`];
}

/**
 * Where the KEO charter is turned on (02 §21.3 point 4): `data-theme` written, and the fonts of
 * packages/ui imported as `@influx/ui/fonts` (02 §21.4 point 5), by exactly the given layouts. Comments do not count.
 */
export function findKeoActivationViolations(
  frontRoot: string,
  layouts: readonly string[],
): string[] {
  const sources = sourceFilesUnder(frontRoot);
  const attribute = sources.filter((file) =>
    KEO_ATTRIBUTE_PATTERN.test(withoutComments(readFileSync(file, "utf8"))),
  );
  const fontImporters = sources.filter((file) =>
    importSpecifiers(readFileSync(file, "utf8")).includes(UI_FONTS_SPECIFIER),
  );
  const relative = (files: readonly string[]) =>
    files.map((file) => relativePath(frontRoot, file));
  return [
    ...exactSetFinding("data-theme is written", relative(attribute), layouts),
    ...exactSetFinding(
      `${UI_FONTS_SPECIFIER} is imported`,
      relative(fontImporters),
      layouts,
    ),
  ];
}

/** Every `createPortal` of src/, comments aside (02 §21.3 point 5): none is allowed. */
export function findPortalUse(frontRoot: string): string[] {
  return sourceFilesUnder(frontRoot)
    .filter((file) =>
      PORTAL_PATTERN.test(withoutComments(readFileSync(file, "utf8"))),
    )
    .map((file) => `${relativePath(frontRoot, file)}: createPortal`);
}

/**
 * Modules of the vitrine (files or folders, relative to the front root) imported from the KEO
 * scopes, plus every listed module that does not exist: a list that names nothing protects nothing.
 */
export function findVitrineImportsUnder(
  frontRoot: string,
  keoScopes: readonly string[],
  vitrineModules: readonly string[],
): string[] {
  const missing = vitrineModules
    .filter((module) => !existsSync(path.join(frontRoot, module)))
    .map((module) => `${module}: listed as a vitrine module, does not exist`);
  const vitrine = vitrineModules.map((module) =>
    path.join(frontRoot, module).replace(SOURCE_FILE, ""),
  );
  const isVitrine = (resolved: string) =>
    vitrine.some(
      (module) => resolved === module || resolved.startsWith(module + path.sep),
    );
  const imports = sourceFilesUnder(frontRoot, keoScopes).flatMap((file) =>
    importSpecifiers(readFileSync(file, "utf8")).flatMap((specifier) => {
      const resolved = resolveLocalSpecifier(frontRoot, file, specifier);
      return resolved !== null && isVitrine(resolved)
        ? [`${relativePath(frontRoot, file)}: imports ${specifier}`]
        : [];
    }),
  );
  return [...missing, ...imports];
}

/** Lines of the given folders matching a pattern, comments aside. */
function findStrippedMatches(
  frontRoot: string,
  folders: readonly string[],
  pattern: RegExp,
): string[] {
  return sourceFilesUnder(frontRoot, folders).flatMap((file) =>
    withoutComments(readFileSync(file, "utf8"))
      .split("\n")
      .flatMap((line, index) =>
        pattern.test(line)
          ? [`${relativePath(frontRoot, file)}:${index + 1}: ${line.trim()}`]
          : [],
      ),
  );
}

/**
 * Lines of the KEO scopes that consume a token of the vitrine: a fragment of its name (a
 * VITRINE_ONLY color without `--color-`, an effect of the landing), not followed by more of a name.
 */
export function findVitrineTokenUse(
  frontRoot: string,
  keoScopes: readonly string[],
  fragments: readonly string[],
): string[] {
  if (fragments.length === 0) return [];
  const escaped = fragments.map((fragment) =>
    fragment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
  );
  return findStrippedMatches(
    frontRoot,
    keoScopes,
    new RegExp(`(?:${escaped.join("|")})(?![\\w-])`),
  );
}

/**
 * Lines of the KEO scopes with a transformation on a state outside `motion-safe:`, or with
 * `transition-all` (20 §11.5; F6).
 */
export function findStateTransforms(
  frontRoot: string,
  keoScopes: readonly string[],
): string[] {
  return sourceFilesUnder(frontRoot, keoScopes).flatMap((file) =>
    withoutComments(readFileSync(file, "utf8"))
      .split("\n")
      .flatMap((line, index) =>
        hasUnsafeStateTransform(line)
          ? [`${relativePath(frontRoot, file)}:${index + 1}: ${line.trim()}`]
          : [],
      ),
  );
}

// ---------------------------------------------------------------------------------------------
// G3g and G3h: the role colors confined, the forbidden pairs of classes (D73; 20 §11.3, §11.4)
// ---------------------------------------------------------------------------------------------

/**
 * A role color used as a class (`text-`, `bg-`, `border-`… `-role-advertiser` / `-role-creator`) or
 * read as a variable. The role colors are a visual mark and nothing else (12 RG7, 20 §11.3).
 */
export const ROLE_COLOR_PATTERN =
  /(?<![\w-])(?:[\w-]+:)*(?:text|bg|border|ring|outline|fill|stroke|decoration|accent|caret|shadow|from|via|to|divide|placeholder)-role-(?:advertiser|creator)(?![\w-])|var\(--color-role-/;

/**
 * G3g: lines outside the given components (relative to the front root) that use a role color, plus
 * every given component that does not exist or does not require its label (`label: string`): a role
 * color is always followed by the role written (P7), the type is what makes it so.
 */
export function findRoleColorUse(
  frontRoot: string,
  allowedComponents: readonly string[],
): string[] {
  const allowed = allowedComponents.map((file) => path.join(frontRoot, file));
  const gaps = allowed.flatMap((file) => {
    if (!existsSync(file)) {
      return [
        `${relativePath(frontRoot, file)}: listed as a role component, does not exist`,
      ];
    }
    return /\blabel:\s*string\b/.test(
      withoutComments(readFileSync(file, "utf8")),
    )
      ? []
      : [
          `${relativePath(frontRoot, file)}: a role component without a required label: string`,
        ];
  });
  const uses = sourceFilesUnder(frontRoot)
    .filter((file) => !allowed.includes(file))
    .flatMap((file) =>
      withoutComments(readFileSync(file, "utf8"))
        .split("\n")
        .flatMap((line, index) =>
          ROLE_COLOR_PATTERN.test(line)
            ? [`${relativePath(frontRoot, file)}:${index + 1}: ${line.trim()}`]
            : [],
        ),
    );
  return [...gaps, ...uses];
}

/** A surface and the foreground classes that must never be painted on it (20 §11.4). */
export type ForbiddenClassPair = {
  surface: string;
  foregrounds: readonly string[];
};

function hasClass(literal: string, className: string): boolean {
  const escaped = className.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(String.raw`(?<![\w-])(?:[\w-]+:)*${escaped}(?![\w-])`).test(
    literal,
  );
}

/**
 * G3h: string literals of the given folders that hold both the surface and a foreground of a
 * forbidden pair (tertiary text, or error text, on `surface-active`). Weak by design: only the
 * same literal is seen; axe is the net for the rest (18 §5.1).
 */
export function findForbiddenClassPairs(
  frontRoot: string,
  folders: readonly string[],
  pairs: readonly ForbiddenClassPair[],
): string[] {
  return sourceFilesUnder(frontRoot, folders).flatMap((file) =>
    [
      ...withoutComments(readFileSync(file, "utf8")).matchAll(
        /"([^"\n]*)"|'([^'\n]*)'|`([^`]*)`/g,
      ),
    ].flatMap((match) => {
      const literal = match[1] ?? match[2] ?? match[3] ?? "";
      return pairs.flatMap(({ surface, foregrounds }) =>
        hasClass(literal, surface)
          ? foregrounds
              .filter((foreground) => hasClass(literal, foreground))
              .map(
                (foreground) =>
                  `${relativePath(frontRoot, file)}: ${foreground} on ${surface} in "${literal.trim()}"`,
              )
          : [],
      );
    }),
  );
}

/** The URL path of a page file under an app folder: route groups `(…)` dropped. */
function routeOfPage(appDirectory: string, pageFile: string): string {
  return path
    .relative(appDirectory, path.dirname(pageFile))
    .split(path.sep)
    .filter((segment) => segment !== "" && !/^\(.+\)$/.test(segment))
    .join("/");
}

/**
 * The member pages are exactly those of the group (18 §5.1 G8): every member path (a slug, both
 * languages, relative to `appDirectory`) is served by a page inside `group`, none outside it, and
 * the group serves no other page. The move into the group changes no URL.
 */
export function findMemberGroupMismatches(
  frontRoot: string,
  appDirectory: string,
  group: string,
  memberPaths: readonly string[],
): string[] {
  const app = path.join(frontRoot, appDirectory);
  const pages = listFiles(app).filter(
    (file) => path.basename(file).replace(SOURCE_FILE, "") === "page",
  );
  const inGroup = (file: string) =>
    path.relative(app, file).split(path.sep).includes(group);
  const grouped = pages.filter(inGroup).map((file) => routeOfPage(app, file));
  const outside = pages
    .filter((file) => !inGroup(file))
    .map((file) => routeOfPage(app, file))
    .filter((route) => memberPaths.includes(route))
    .map((route) => `/${route}: a member page outside ${group}`);
  const missing = memberPaths
    .filter((route) => !grouped.includes(route))
    .map((route) => `/${route}: no page in ${group}`);
  const foreign = grouped
    .filter((route) => !memberPaths.includes(route))
    .map((route) => `/${route}: in ${group}, not a member page`);
  return [...outside, ...missing, ...foreign];
}

// G9: the session read confined to the shells (D73; 02 §21.5 point 1, §21.9; 18 §5.1, TD1.12)
// ---------------------------------------------------------------------------------------------

/** Where a front reads its session: one module calls the endpoint, its shells alone import it. */
export type SessionReadChain = {
  /** The module that calls the session endpoint through the relay client (member-auth.ts…). */
  module: string;
  /** The function of that module that reads the session (`readMe`…). */
  reader: string;
  /** The endpoint it reads (`/v1/me`…): a GET of it anywhere else bypasses the chain. */
  endpoint: string;
  /** The shells, the only modules that import the reader (02 §21.5 point 1). */
  shells: readonly string[];
};

/**
 * G9, the guard of the importers, like G5 (d): the session is read by the shells alone, which
 * hand it to the pages (`useMember()`, `useMe()`). Finds a module of the chain that is missing or
 * no longer exports its reader, an importer of the module naming the reader outside the shells
 * (named or namespace import alike), a shell that no longer reads it, and a GET of the endpoint
 * outside the module. Comments do not count.
 */
export function findSessionReadViolations(
  frontRoot: string,
  chain: SessionReadChain,
): string[] {
  const moduleFile = path.join(frontRoot, chain.module);
  if (!existsSync(moduleFile)) {
    return [`${chain.module}: the session module does not exist`];
  }
  const reader = new RegExp(`\\b${chain.reader}\\b`);
  const exported = new RegExp(
    `\\bexport\\s+(?:async\\s+)?(?:function\\s*\\*?|const|let)\\s*${chain.reader}\\b`,
  );
  const findings = exported.test(
    withoutComments(readFileSync(moduleFile, "utf8")),
  )
    ? []
    : [`${chain.module}: does not export ${chain.reader}`];
  const target = moduleFile.replace(SOURCE_FILE, "");
  const endpoint = chain.endpoint.replace(/[.*+?^$()|[\]\\/{}]/g, "\\$&");
  const endpointRead = new RegExp(
    `["'\`]GET["'\`]\\s*,\\s*["'\`]${endpoint}["'\`]`,
  );
  const importers: string[] = [];
  for (const file of sourceFilesUnder(frontRoot)) {
    const relative = relativePath(frontRoot, file);
    if (relative === chain.module) continue;
    const source = withoutComments(readFileSync(file, "utf8"));
    const importsModule = importSpecifiers(source).some(
      (specifier) =>
        resolveLocalSpecifier(frontRoot, file, specifier) === target,
    );
    if (importsModule && reader.test(source)) importers.push(relative);
    if (endpointRead.test(source)) {
      findings.push(`${relative}: reads GET ${chain.endpoint} itself`);
    }
  }
  return [
    ...findings,
    ...exactSetFinding(
      `${chain.module} ${chain.reader} is imported`,
      importers,
      chain.shells,
    ),
  ];
}

// ---------------------------------------------------------------------------------------------
// G3i and the guards of the RK milestone (D75; 02 §21.3 point 3; 18 §5.1, TK7.1 to TK7.5)
// ---------------------------------------------------------------------------------------------
// Tailwind v4 inscribes in its utilities the @theme value of the tokens of some namespaces: the
// shadows (`.shadow-action-glow{--tw-shadow:none}`, constat C1), the breakpoints and the containers
// of the media queries. A redefinition in the KEO block is then never read. The sources are checked
// (G3i a); so is the build (G3i b), where a future namespace inscribed the same way shows first.

/** Namespaces whose @theme value Tailwind inscribes where it is used (G3i a; 02 §21.3 point 3). */
export const KEO_FORBIDDEN_NAMESPACES: readonly string[] = [
  "--shadow-",
  "--inset-shadow-",
  "--drop-shadow-",
  "--text-shadow-",
  "--breakpoint-",
  "--container-",
];

/** A token allowed to mix the brand green with transparency (RK-A), and its ceiling in percent. */
export type ColorMixAllowance = { name: string; maxPercent?: number };

/** The only `color-mix` RK-A admits: the brand green, a percentage, then transparency. */
const BRAND_COLOR_MIX =
  /^color-mix\(\s*in srgb\s*,\s*var\(\s*--color-brand-primary\s*\)\s+(\d+(?:\.\d+)?)%\s*,\s*transparent\s*\)$/;

/** Every `color-mix(…)` of a value, its parentheses balanced. */
function colorMixesOf(value: string): string[] {
  const found: string[] = [];
  let from = value.indexOf("color-mix(");
  while (from !== -1) {
    let depth = 0;
    let end = value.length;
    for (let index = from; index < value.length; index += 1) {
      const char = value[index];
      if (char === "(") depth += 1;
      if (char === ")") depth -= 1;
      if (char === ")" && depth === 0) {
        end = index + 1;
        break;
      }
    }
    found.push(value.slice(from, end));
    from = value.indexOf("color-mix(", from + 1);
  }
  return found;
}

/**
 * G3i (a), on the sources: a token of a namespace that Tailwind inscribes, redefined in the KEO
 * block; an `@theme inline` (every value inscribed, 02 §21.3 point 3); a `color-mix` anywhere but
 * in a token of `allowances` inside the KEO block, in the form RK-A admits, within its ceiling.
 */
export function findKeoTrapViolations(
  css: string,
  allowances: readonly ColorMixAllowance[],
): string[] {
  const findings: string[] = [];
  if (/@theme\b[^{;]*\binline\b/.test(css.replace(/\/\*[\s\S]*?\*\//g, " "))) {
    findings.push(
      "@theme inline: Tailwind would inscribe every value, KEO would be read nowhere",
    );
  }
  for (const block of keoBlocks(css)) {
    for (const { name } of block.declarations) {
      const namespace = KEO_FORBIDDEN_NAMESPACES.find((prefix) =>
        name.startsWith(prefix),
      );
      if (namespace !== undefined) {
        findings.push(
          `${name}: redefined in the KEO block, in the ${namespace}* namespace that Tailwind inscribes`,
        );
      }
    }
  }
  const visit = (block: CssBlock, inKeo: boolean) => {
    for (const { name, value } of block.declarations) {
      for (const mix of colorMixesOf(value)) {
        const allowance = inKeo
          ? allowances.find((entry) => entry.name === name)
          : undefined;
        const percent = BRAND_COLOR_MIX.exec(mix)?.[1];
        if (allowance === undefined) {
          findings.push(
            `${name}: "${mix}" outside the tokens of RK-A${inKeo ? "" : " (not in the KEO block)"}`,
          );
        } else if (percent === undefined) {
          findings.push(
            `${name}: "${mix}" is not the brand green mixed with transparency`,
          );
        } else if (
          allowance.maxPercent !== undefined &&
          Number(percent) > allowance.maxPercent
        ) {
          findings.push(
            `${name}: ${percent}% over its ceiling of ${allowance.maxPercent}%`,
          );
        }
      }
    }
    for (const child of block.blocks) {
      visit(child, inKeo || KEO_SELECTOR.test(child.prelude));
    }
  };
  visit(parseCssBlocks(css), false);
  return findings;
}

/** Tailwind's utility roots per token namespace, the longer namespace first (G3i b). */
const NAMESPACE_UTILITY_ROOTS: ReadonlyArray<
  readonly [string, readonly string[]]
> = [
  ["--inset-shadow-", ["inset-shadow"]],
  ["--drop-shadow-", ["drop-shadow"]],
  ["--text-shadow-", ["text-shadow"]],
  ["--shadow-", ["shadow"]],
  [
    "--color-",
    [
      "bg",
      "text",
      "border",
      ...["t", "r", "b", "l", "x", "y", "s", "e"].map(
        (side) => `border-${side}`,
      ),
      "outline",
      "ring",
      "ring-offset",
      "fill",
      "stroke",
      "accent",
      "caret",
      "decoration",
      "divide",
      "placeholder",
      "from",
      "via",
      "to",
      "shadow",
      "inset-shadow",
      "drop-shadow",
      "text-shadow",
    ],
  ],
  [
    "--radius-",
    [
      "rounded",
      ...["t", "r", "b", "l", "s", "e", "tl", "tr", "br", "bl"].map(
        (corner) => `rounded-${corner}`,
      ),
      ...["ss", "se", "es", "ee"].map((corner) => `rounded-${corner}`),
    ],
  ],
  ["--font-weight-", ["font"]],
  ["--font-", ["font"]],
  ["--text-", ["text"]],
  ["--tracking-", ["tracking"]],
  ["--leading-", ["leading"]],
  ["--background-image-", ["bg"]],
];

/** A CSS identifier unescaped: `hover\:bg-x` gives `hover:bg-x`, `\31 0` gives `10`. */
function unescapeCssIdentifier(text: string): string {
  return text.replace(
    /\\([0-9a-fA-F]{1,6})\s?|\\([\s\S])/g,
    (_whole, hex: string | undefined, char: string | undefined) =>
      hex === undefined
        ? (char ?? "")
        : String.fromCodePoint(parseInt(hex, 16)),
  );
}

/** The class names of a selector, unescaped: `.hover\:bg-x:hover` gives `hover:bg-x`. */
export function selectorClasses(selector: string): string[] {
  return [
    ...selector.matchAll(
      /\.((?:\\[0-9a-fA-F]{1,6}\s?|\\[^0-9a-fA-F\r\n]|[\w-])+)/g,
    ),
  ].map((match) => unescapeCssIdentifier(match[1] ?? ""));
}

/** A class without its variants and its important mark: `motion-safe:hover:scale-x!` → `scale-x`. */
export function utilityOf(className: string): string {
  let depth = 0;
  let start = 0;
  for (let index = 0; index < className.length; index += 1) {
    const char = className[index];
    if (char === "(" || char === "[") depth += 1;
    if (char === ")" || char === "]") depth -= 1;
    if (char === ":" && depth === 0) start = index + 1;
  }
  return className.slice(start).replace(/^!|!$/g, "");
}

/** A style rule of a stylesheet: its selector, nesting resolved, and its own declarations. */
type StyleRule = { selector: string; declarations: CssDeclaration[] };

/**
 * The style rules of a stylesheet, minified or not: an at-rule keeps the selector around it, a
 * nested `&` stands for it (Tailwind writes its variants nested, `.x{&:hover{@media …{…}}}`).
 */
function styleRules(css: string): StyleRule[] {
  const rules: StyleRule[] = [];
  const visit = (block: CssBlock, selector: string) => {
    for (const child of block.blocks) {
      const own = child.prelude.startsWith("@")
        ? selector
        : child.prelude.includes("&")
          ? child.prelude.replaceAll("&", selector)
          : selector === ""
            ? child.prelude
            : `${selector} ${child.prelude}`;
      if (own !== "" && child.declarations.length > 0) {
        rules.push({ selector: own, declarations: child.declarations });
      }
      visit(child, own);
    }
  };
  visit(parseCssBlocks(css), "");
  return rules;
}

/** `var(--name)` or `var(--name, fallback)`, for one name. */
function readsOf(name: string): RegExp {
  return new RegExp(
    `var\\(\\s*${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*[,)]`,
  );
}

/**
 * G3i (b), on the build: every rule of a utility of a token that the KEO block redefines
 * (`shadow-action-glow` for `--shadow-action-glow`, `rounded-card` for `--radius-card`, variants
 * included) reads `var(--name)`; a rule that holds a value instead keeps the vitrine's under KEO.
 */
export function findInscribedKeoTokens(
  builtCss: string,
  tokensCss: string,
): string[] {
  const { keo } = tokenScopes(tokensCss);
  if (keo === null) return ["no KEO block in the tokens"];
  const rules = styleRules(builtCss);
  return [...keo.keys()].flatMap((name) => {
    const namespace = NAMESPACE_UTILITY_ROOTS.find(([prefix]) =>
      name.startsWith(prefix),
    );
    if (namespace === undefined) return [];
    const key = name.slice(namespace[0].length);
    const utilities = new Set(namespace[1].map((root) => `${root}-${key}`));
    const reads = readsOf(name);
    return rules.flatMap((rule) => {
      const isUtility = selectorClasses(rule.selector).some((className) =>
        utilities.has(utilityOf(className)),
      );
      const text = rule.declarations
        .map((declaration) => `${declaration.name}:${declaration.value}`)
        .join(";");
      return isUtility && !reads.test(text)
        ? [
            `${rule.selector}: a utility of ${name} that does not read var(${name}) {${text}}`,
          ]
        : [];
    });
  });
}

/**
 * G3i (b): a token that the KEO block redefines and that no rule of the build reads through
 * `var()` (unread, or inscribed), unless `justified` names it; a justified entry that is read, or
 * that the block does not redefine, is stale.
 */
export function findUnreadKeoTokens(
  builtCss: string,
  tokensCss: string,
  justified: readonly string[] = [],
): string[] {
  const { keo } = tokenScopes(tokensCss);
  if (keo === null) return ["no KEO block in the tokens"];
  const source = builtCss.replace(/\/\*[\s\S]*?\*\//g, " ");
  const unread = [...keo.keys()].filter((name) => !readsOf(name).test(source));
  return [
    ...unread
      .filter((name) => !justified.includes(name))
      .map(
        (name) =>
          `${name}: redefined in the KEO block, read through var() by no rule of the build`,
      ),
    ...justified
      .filter((name) => !unread.includes(name))
      .map(
        (name) =>
          `${name}: stale justification, ${keo.has(name) ? "read by the build" : "not redefined in the KEO block"}`,
      ),
  ];
}

/** Every class named by a selector of a stylesheet, unescaped (TK7.2). */
export function compiledClasses(css: string): Set<string> {
  const classes = new Set<string>();
  const visit = (block: CssBlock) => {
    for (const child of block.blocks) {
      if (!child.prelude.startsWith("@")) {
        for (const className of selectorClasses(child.prelude)) {
          classes.add(className);
        }
      }
      visit(child);
    }
  };
  visit(parseCssBlocks(css));
  return classes;
}

/**
 * The class names of a module of classes (TK7.2): the words of its double-quoted literals, the
 * module specifiers of its imports and its directives (`"use client"`) aside.
 */
export function classLiteralsOf(source: string): string[] {
  return classesOf(
    withoutComments(source)
      .replace(/^\s*["']use (?:client|server)["'];?\s*$/gm, "")
      .replace(/\bfrom\s+"[^"]*"/g, "")
      .replace(/\bimport\s+"[^"]*"/g, ""),
  );
}

/**
 * TK7.2: the classes that no rule of the build names (`tracking-wide` without a token, constat C3).
 * `allowed` lists the justified ones; an entry that is compiled, or that no class names, is stale.
 */
export function findClassesWithoutRule(
  classes: readonly string[],
  builtCss: string,
  allowed: readonly string[] = [],
): string[] {
  const compiled = compiledClasses(builtCss);
  const unique = [...new Set(classes)];
  const missing = unique.filter((name) => !compiled.has(name));
  return [
    ...missing
      .filter((name) => !allowed.includes(name))
      .map((name) => `${name}: no rule of the build names this class`),
    ...allowed
      .filter((name) => !missing.includes(name))
      .map(
        (name) =>
          `${name}: stale entry, ${unique.includes(name) ? "compiled" : "no class names it"}`,
      ),
  ];
}

/** A value that follows the width of the window (20 §11.5): `clamp(` or a `vw` length. */
const FLUID_VALUE = /clamp\(|\d(?:\.\d+)?vw\b/;

/** The size and letter-spacing tokens: `--text-*` (not their `--line-height`) and `--tracking-*`. */
function isTypographyToken(name: string): boolean {
  return (
    (name.startsWith("--text-") &&
      !name.startsWith("--text-shadow-") &&
      !name.slice(2).includes("--")) ||
    name.startsWith("--tracking-")
  );
}

/**
 * The fluid typography of the vitrine (20 §11.5: `text-lead`, `text-heading-*`, `text-display`,
 * `text-amount-lg`, `text-figure-*`), read in the values rather than listed: the tokens whose
 * vitrine value follows the window. They stay with the vitrine; G8 refuses their classes under KEO.
 */
export function fluidTypographyTokens(css: string): string[] {
  return [...effectiveTokens(css, "vitrine")]
    .filter(
      ([name, value]) => isTypographyToken(name) && FLUID_VALUE.test(value),
    )
    .map(([name]) => name);
}

/** The classes of the fluid typography (`text-lead`…), for G8 under the KEO scopes (TK7.3). */
export function fluidTypographyClasses(css: string): string[] {
  return fluidTypographyTokens(css).map((name) => name.slice(2));
}

/**
 * TK7.3: no `clamp(` nor `vw` in a `--text-*` or `--tracking-*` that KEO may consume: every such
 * token but the vitrine's fluid ones, at its effective KEO value (aliases followed), and every one
 * that the KEO block declares.
 */
export function findFluidKeoTypography(css: string): string[] {
  const fluid = fluidTypographyTokens(css);
  const block = tokenScopes(css).keo ?? new Map<string, string>();
  return [...effectiveTokens(css, "keo")]
    .filter(
      ([name, value]) =>
        isTypographyToken(name) &&
        FLUID_VALUE.test(value) &&
        (!fluid.includes(name) || block.has(name)),
    )
    .map(([name, value]) => `${name}: "${value}" follows the window under KEO`);
}

/** The font smoothing, by property or by Tailwind's utility (`@apply antialiased`). */
const SMOOTHING = /font-smoothing|(?<![\w-])(?:subpixel-)?antialiased(?![\w-])/;

/** A selector whose subject is the document: `:root`, `html…` or `body…`, after any ancestor. */
function selectsDocument(selector: string): boolean {
  return selector.split(",").some((part) => {
    const subject =
      part
        .trim()
        .split(/\s*[\s>+~]\s*/)
        .at(-1) ?? "";
    return /^(?::root|html|body)(?![\w-])/.test(subject);
  });
}

/**
 * TK7.5: a font smoothing declared on `:root`, `html` or `body` (20 §11.5: under KEO only, by the
 * `antialiased` utility on the KEO container; the vitrine stays `auto`). The innermost rules of a
 * stylesheet, comments aside, so that an `@apply` counts as much as a property.
 */
export function findDocumentSmoothing(css: string): string[] {
  const source = css.replace(/\/\*[\s\S]*?\*\//g, " ");
  return [...source.matchAll(/([^{};]*)\{([^{}]*)\}/g)].flatMap((match) => {
    const selector = collapse(match[1] ?? "");
    const body = match[2] ?? "";
    return selectsDocument(selector) && SMOOTHING.test(body)
      ? [`${selector}: declares a font smoothing (${collapse(body)})`]
      : [];
  });
}

/**
 * A token confined to a few files (TK7.5: `badge-error-bg` to the badge of an error, never the
 * ground of a notice, D72): every line elsewhere in src/ that names it as a class or a variable,
 * comments aside, and every listed file that does not exist.
 */
export function findTokenUseOutside(
  frontRoot: string,
  fragment: string,
  allowedFiles: readonly string[],
): string[] {
  const allowed = allowedFiles.map((file) => path.join(frontRoot, file));
  const missing = allowed
    .filter((file) => !existsSync(file))
    .map(
      (file) =>
        `${relativePath(frontRoot, file)}: listed as allowed to use ${fragment}, does not exist`,
    );
  const pattern = new RegExp(
    `(?<!\\w)${fragment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\w-])`,
  );
  const uses = sourceFilesUnder(frontRoot)
    .filter((file) => !allowed.includes(file))
    .flatMap((file) =>
      withoutComments(readFileSync(file, "utf8"))
        .split("\n")
        .flatMap((line, index) =>
          pattern.test(line)
            ? [`${relativePath(frontRoot, file)}:${index + 1}: ${line.trim()}`]
            : [],
        ),
    );
  return [...missing, ...uses];
}
