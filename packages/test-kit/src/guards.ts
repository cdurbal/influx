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
  "e094e84641c6fea702f8bf97e821ccfd36863ea1ba83b850347f62e1ea257e20";

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
 * Data-layer imports, Server Actions, and environment reads outside the config file, in the relay
 * files and in the health route of web (EC-22).
 */
export function findRelayContentViolations(
  frontRoot: string,
  frontRoutes: FrontRoutes = RELAY_ONLY,
): string[] {
  const files: string[] = [
    ...Object.values(RELAY_FILES),
    ...(frontRoutes.healthRoute ? [HEALTH_ROUTE_FILE] : []),
  ];
  return files.flatMap((relative) => {
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
 * Guard of the importers: relay.ts is imported by the route files only (the relay route, and the
 * health route of web, EC-22), api-client.ts by relay.ts only, config/server.ts by api-client.ts
 * only. This keeps every component of the landing page away from the network (CA8).
 */
export function findRelayImporterViolations(
  frontRoot: string,
  frontRoutes: FrontRoutes = RELAY_ONLY,
): string[] {
  const chain: ReadonlyArray<
    readonly [target: string, onlyImporters: readonly string[]]
  > = [
    [RELAY_FILES.relay, allowedRouteFilesOf(frontRoutes)],
    [RELAY_FILES.apiClient, [RELAY_FILES.relay]],
    [RELAY_FILES.config, [RELAY_FILES.apiClient]],
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
  return chain.flatMap(([target, onlyImporters]) => {
    const actual = [...(importers.get(withoutExtension(target)) ?? [])].sort();
    const expected = [...onlyImporters].sort();
    return actual.join("\n") === expected.join("\n")
      ? []
      : [
          `${target} is imported by [${actual.join(", ")}], expected ${expected.join(", ")} only`,
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
 * is not consumable under KEO (G8): its stale resolution is no gap.
 */
export function findAliasClosureGaps(
  css: string,
  vitrineOnly: readonly string[] = [],
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
  return [...names].flatMap((name) => {
    if (vitrineOnly.includes(name)) return [];
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
    return varReferences(ownValue).length > 0 &&
      varReferences(keoValue).length > 0 &&
      keoValue !== ownValue
      ? [
          `${name}: redeclared in the KEO block as "${keoValue}", another target than "${ownValue}"`,
        ]
      : [];
  });
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

export const FONTS_DIRECTORY = "src/styles/fonts";
export const FONTS_MANIFEST = `${FONTS_DIRECTORY}/FONTS.md`;
export const FONTS_MODULE = "src/styles/fonts.ts";

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
 * Font violations of one front: a woff2 outside `src/styles/fonts/`, a file missing from the
 * manifest or listed without being there, a SHA-256 or a `wOF2` signature that is wrong, a
 * missing OFL text, a preload budget over the ceiling or off the pin.
 */
export function findFontViolations(frontRoot: string): string[] {
  const violations: string[] = [];
  const fontsDirectory = path.join(frontRoot, FONTS_DIRECTORY);
  const sources = ["src", "public"]
    .map((directory) => path.join(frontRoot, directory))
    .filter((directory) => existsSync(directory));
  const woff2Files = sources
    .flatMap(listFiles)
    .filter((file) => /\.woff2?$/i.test(file));
  for (const file of woff2Files) {
    if (path.dirname(path.resolve(file)) !== path.resolve(fontsDirectory)) {
      violations.push(
        `${relativePath(frontRoot, file)}: font outside ${FONTS_DIRECTORY}/`,
      );
    }
  }
  const manifestFile = path.join(frontRoot, FONTS_MANIFEST);
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

/** Files of the fonts directory, the manifest and fonts.ts that differ between two fronts. */
export function findFontCopyDivergences(
  frontRoot: string,
  otherRoot: string,
): string[] {
  const names = (root: string) =>
    existsSync(path.join(root, FONTS_DIRECTORY))
      ? readdirSync(path.join(root, FONTS_DIRECTORY)).sort()
      : [];
  const relatives = [
    ...new Set([...names(frontRoot), ...names(otherRoot)]),
  ].map((name) => `${FONTS_DIRECTORY}/${name}`);
  return [...relatives, FONTS_MODULE].flatMap((relative) => {
    const first = path.join(frontRoot, relative);
    const second = path.join(otherRoot, relative);
    if (!existsSync(first) || !existsSync(second)) {
      return [`${relative}: present in only one front`];
    }
    return sha256OfFile(first) === sha256OfFile(second)
      ? []
      : [`${relative}: differs between the two fronts`];
  });
}
