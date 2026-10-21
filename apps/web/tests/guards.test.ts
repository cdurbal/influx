// Guard tests of apps/web (docs/landing-page/01-architecture.md §9.3, docs/mvp/02 §13.1, 18 §5).
// File reading only: deterministic, no browser, no network. Shared detectors live in
// @influx/test-kit (docs/mvp/18-plan-de-test-mvp.md §5, docs/mvp/21 §4 J1-E).
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  BROWSER_RELAY_CLIENT_FILE,
  findBrowserRelayClientMismatches,
  findClassListConflicts,
  findMatches as findMatchesIn,
  findNetworkOrStorageUse,
  findPagesRouterDirectories,
  findPrimitiveBaseClassConflicts,
  findRelayContentViolations,
  findRelayFingerprintMismatches,
  findRelayImporterViolations,
  findRouteFileViolations,
  HARD_CODED_COLOR_PATTERN,
  HARD_CODED_LENGTH_PATTERN,
  listFiles,
  relativePath,
} from "@influx/test-kit/guards";
import { describe, expect, it } from "vitest";

const WEB_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const SRC = path.join(WEB_ROOT, "src");

function relative(file: string): string {
  return relativePath(WEB_ROOT, file);
}

/** Scope of G1 to G3: every source file of the landing page (docs/landing-page/01-architecture.md §9.3) */
const SCOPED_FILES = listFiles(SRC).filter((file) =>
  /\.(ts|tsx|json|css)$/.test(file),
);

function findMatches(pattern: RegExp, files: readonly string[]): string[] {
  return findMatchesIn(pattern, files, WEB_ROOT);
}

// Tightened at J9 commit 5 (02 §13.1, 18 §5 G1): a mailto: or tel: link is a way out of the
// platform. Allowed only in the legal pages and the public contact page, each file named here,
// never a folder. Empty today: the legal texts come from apps/api without links (EC-62), and no
// contact page exists yet.
const G1_ALLOWED_FILES: readonly string[] = [];

describe("G1 tightened: no mailto or tel outside named legal and contact files (18 §5 G1)", () => {
  it("finds no mailto: or tel: outside the allowlist", () => {
    const files = SCOPED_FILES.filter(
      (file) => !G1_ALLOWED_FILES.includes(relative(file)),
    );
    expect(findMatches(/mailto:|\btel:/, files)).toEqual([]);
  });

  it("names existing files only, never a folder", () => {
    for (const file of G1_ALLOWED_FILES) {
      expect(file).toMatch(/^src\/.+\.(tsx?|json)$/);
      expect(existsSync(path.join(WEB_ROOT, file)), file).toBe(true);
    }
  });
});

// G2 lifted at J9 commit 4, in the commit of its three replacements (18 §5, EC-J9-1): this
// tightened guard (a), the CSP tested on the production build (b, e2e/security-headers.spec.ts,
// T10.6), and the ESLint ban of `fetch` outside src/server/api-client.ts (c, J1).
describe("G2 replaced: no literal URL outside src/config/ and src/locales/ (18 §5 G2 a)", () => {
  const URL_ALLOWED_DIRS = ["config", "locales"].map(
    (dir) => path.join(SRC, dir) + path.sep,
  );

  it("finds no http(s):// or ws(s):// URL anywhere else in src/", () => {
    const files = SCOPED_FILES.filter(
      (file) => !URL_ALLOWED_DIRS.some((dir) => file.startsWith(dir)),
    );
    expect(files.length).toBeGreaterThan(0);
    expect(findMatches(/\b(?:https?|wss?):\/\//, files)).toEqual([]);
  });
});

describe("G3: no hard-coded color or length outside the token files (CA22)", () => {
  const TOKEN_FILES = new Set([
    "src/styles/tokens.css",
    "src/styles/image-sizes.ts",
  ]);
  const files = SCOPED_FILES.filter((file) => !TOKEN_FILES.has(relative(file)));

  it("finds no hexadecimal color or color function", () => {
    expect(findMatches(HARD_CODED_COLOR_PATTERN, files)).toEqual([]);
  });

  it("finds no literal length (px, rem, em, vh, vw, ch)", () => {
    expect(findMatches(HARD_CODED_LENGTH_PATTERN, files)).toEqual([]);
  });

  it("keeps a single tokens file, marked with its D6 status", () => {
    const cssFiles = listFiles(SRC)
      .filter((file) => file.endsWith(".css"))
      .map(relative);
    expect(cssFiles.sort()).toEqual([
      "src/app/globals.css",
      "src/styles/tokens.css",
    ]);
    const tokens = readFileSync(path.join(SRC, "styles", "tokens.css"), "utf8");
    expect(tokens.slice(0, 200)).toContain("D6 tranchée");
    expect(
      readFileSync(path.join(SRC, "app", "globals.css"), "utf8"),
    ).not.toMatch(/--color-[\w-]+\s*:/);
  });
});

// G4 left with src/content/placeholders/ at J9 commit 5 and was replaced by this absence guard
// (18 §5 G4): no image file anywhere in apps/web outside the declared manifest of brand assets.
// The manifest is CREDITS.md (the photos, final since 2026-10-21, each still credited) plus the
// one uncredited pictogram declared here. Creators' visuals are uploaded and moderated (T9).
const IMAGES_DIR = path.join(SRC, "content", "images");
const CREDITS = readFileSync(path.join(IMAGES_DIR, "CREDITS.md"), "utf8");
const CREDITED_PHOTOS = [...CREDITS.matchAll(/^\|\s*(img-[\w-]+\.jpg)\s*\|/gm)]
  .map((match) => `src/content/images/${match[1]}`)
  .sort();
const BRAND_ASSET_MANIFEST: readonly string[] = [
  ...CREDITED_PHOTOS,
  "src/components/ui/camera.png",
];

const IMAGE_FILE = /\.(jpe?g|png|webp|avif|gif|svg|ico|bmp|tiff?|heic)$/i;

/** Folders that are not source: dependencies, build and test outputs. */
const NON_SOURCE_DIRECTORIES = new Set([
  "node_modules",
  ".next",
  ".turbo",
  "out",
  "build",
  "coverage",
  "test-results",
  "playwright-report",
]);

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (!entry.isDirectory()) {
      return [fullPath];
    }
    return NON_SOURCE_DIRECTORIES.has(entry.name) ? [] : sourceFiles(fullPath);
  });
}

describe("G4 replaced: no image outside the brand asset manifest (18 §5 G4)", () => {
  it("finds no image file in apps/web outside the manifest", () => {
    const images = sourceFiles(WEB_ROOT)
      .map(relative)
      .filter((file) => IMAGE_FILE.test(file))
      .sort();
    expect(images).toEqual([...BRAND_ASSET_MANIFEST].sort());
  });

  it("credits each photo: author, Pexels source page and license (CA26)", () => {
    expect(CREDITED_PHOTOS.length).toBeGreaterThan(0);
    for (const file of CREDITED_PHOTOS) {
      // Table cells may be padded by Prettier: compare trimmed first cells.
      const line = CREDITS.split("\n").find(
        (row) => row.split("|")[1]?.trim() === path.basename(file),
      );
      expect(line, file).toBeDefined();
      expect(line, file).toMatch(/https:\/\/www\.pexels\.com\/@/);
      expect(line, file).toMatch(/https:\/\/www\.pexels\.com\/photo\//);
      expect(line, file).toContain("Licence Pexels");
    }
  });
});

// G5 ("no route.ts under src/app", CA8) was lifted at J1 in the commit that introduced the relay,
// and replaced by this stricter guard (02 §13.1, 18 §5, 21 §4 J1-C). The landing page still never
// reaches the network: only the route file imports the relay, which alone imports the API client.
describe("G5 replaced: the relay is the only server endpoint (21 J1-C, 03 PP-12)", () => {
  it("has exactly one route file under src/app: the relay", () => {
    expect(findRouteFileViolations(WEB_ROOT)).toEqual([]);
  });

  it("has no Pages Router directory, pages/ nor src/pages/ (18 §5 G5 b)", () => {
    expect(findPagesRouterDirectories(WEB_ROOT)).toEqual([]);
  });

  it("keeps data-layer imports, Server Actions and environment reads out of the relay", () => {
    expect(findRelayContentViolations(WEB_ROOT)).toEqual([]);
  });

  it("reaches the API client along a single chain: route, relay, API client, config", () => {
    expect(findRelayImporterViolations(WEB_ROOT)).toEqual([]);
  });

  it("matches the pinned SHA-256 of the four relay files (T7.8)", () => {
    expect(findRelayFingerprintMismatches(WEB_ROOT)).toEqual([]);
  });
});

// G6 (IS_MOCKUP === true) and annex 3 (fictitious values confined) left with the fictitious module
// at J9 commit 5, replaced by this absence guard (18 §5 G6 a, annex 3): the module, the constant
// and the banner cannot come back silently. Indexing is a matter of environment (J4S-3 below).
describe("G6 and annex 3 replaced: no fictitious module, mockup constant or banner (18 §5 G6)", () => {
  const CODE_FILES = [
    ...SCOPED_FILES,
    path.join(WEB_ROOT, "eslint.config.mjs"),
    path.join(WEB_ROOT, "next.config.ts"),
  ];
  // Comments may tell the history of the mockup: only code and messages are checked.
  const stripComments = (source: string) =>
    source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

  it("has no src/content/placeholders/ and no banner component", () => {
    expect(existsSync(path.join(SRC, "content", "placeholders"))).toBe(false);
    const banners = listFiles(SRC)
      .map(relative)
      .filter((file) => /mockup-?banner/i.test(path.basename(file)));
    expect(banners).toEqual([]);
  });

  it("never names the module, the constant or the banner in code", () => {
    const names =
      /\bIS_MOCKUP\b|\bMockupBanner\b|getPlaceholderContent|content\/placeholders/;
    const hits = CODE_FILES.filter((file) =>
      names.test(stripComments(readFileSync(file, "utf8"))),
    ).map(relative);
    expect(hits).toEqual([]);
  });

  it("carries none of the former fictitious values (CA15)", () => {
    const fictitiousValues = [
      "contact@influx.example",
      "Lysmouré",
      "Kaffrune",
      "Ondarive",
      "Bolbruyère",
      "Clavembre",
      "Cousevaine",
      "Pédalune",
      "Aurifane",
      "Crêtenval",
      "Vuescarde",
      "Fjelmora",
      "Flammoisy",
      "Croquembel",
      "Semavrille",
      "Infuvelle",
      "contenus fictifs",
      "fictitious content",
      "rien n’a été envoyé",
      "nothing was sent",
      "Votre univers cuisine",
      "Your cooking content",
      "Donnée fictive",
      "Fictitious figure",
      "Maquette",
      "Mockup",
    ];
    const leaks = CODE_FILES.flatMap((file) => {
      const content = stripComments(readFileSync(file, "utf8"));
      return fictitiousValues
        .filter((value) => content.includes(value))
        .map((value) => `${relative(file)}: ${value}`);
    });
    expect(leaks).toEqual([]);
  });
});

describe("Additional guards", () => {
  it("has identical FR and EN translation keys (CA23)", () => {
    type Messages = { [key: string]: string | Messages };
    const flatten = (messages: Messages, prefix = ""): string[] =>
      Object.entries(messages).flatMap(([key, value]) =>
        typeof value === "string"
          ? [`${prefix}${key}`]
          : flatten(value, `${prefix}${key}.`),
      );
    // Every translation file, not only landing.json (02 §13.1, garde annexe).
    const files = readdirSync(path.join(SRC, "locales", "fr")).sort();
    expect(readdirSync(path.join(SRC, "locales", "en")).sort()).toEqual(files);
    expect(files).toEqual([
      "account.json",
      "auth.json",
      "errors.json",
      "landing.json",
      "legal.json",
    ]);
    for (const file of files) {
      const read = (locale: string) =>
        JSON.parse(
          readFileSync(path.join(SRC, "locales", locale, file), "utf8"),
        ) as Messages;
      expect(flatten(read("en")).sort()).toEqual(flatten(read("fr")).sort());
    }
  });

  it("pins the browser relay client, the only browser module that calls the network (J3 commit 12)", () => {
    expect(findBrowserRelayClientMismatches(WEB_ROOT)).toEqual([]);
    const source = readFileSync(
      path.join(WEB_ROOT, BROWSER_RELAY_CLIENT_FILE),
      "utf8",
    );
    // Same origin only: one fetch, on the relay prefix, never an absolute URL. The query (J5,
    // EC-62) is made of plain characters only: nothing is percent-encoded.
    expect(source.match(/\bfetch\(/g)).toHaveLength(1);
    expect(source).toMatch(/fetch\(`\$\{RELAY_PREFIX\}\$\{path\}\$\{search\}`/);
    expect(source).toContain(
      "const QUERY_PART_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;",
    );
    expect(source).toMatch(/credentials: "same-origin"/);
    expect(source).toMatch(/redirect: "error"/);
  });

  // Split at J1 (02 §13.2, 18 §5 annex 2): network only in src/server/api-client.ts, storage never.
  it("uses no storage API, and no network API outside the API client (CA8, CA11)", () => {
    const codeFiles = SCOPED_FILES.filter((file) => /\.tsx?$/.test(file));
    expect(findNetworkOrStorageUse(codeFiles, WEB_ROOT)).toEqual([]);
  });

  it("gives the CreatorCard type no identity field (D16, CA17)", () => {
    const source = readFileSync(
      path.join(SRC, "content", "landing-content.ts"),
      "utf8",
    );
    const block = source.match(/export type CreatorCard = \{([\s\S]*?)\n\};/);
    expect(block).not.toBeNull();
    const fields = [...(block?.[1] ?? "").matchAll(/^\s*(\w+)\??:/gm)].map(
      (match) => match[1],
    );
    expect(fields.sort()).toEqual(
      [
        "audienceMax",
        "audienceMin",
        "country",
        "id",
        "image",
        "theme",
        "verified",
      ].sort(),
    );
  });
});

describe("G7: no Tailwind class conflict that cn() cannot resolve (10 #10)", () => {
  // Detector and its self-check: @influx/test-kit (packages/test-kit/tests/guards.test.ts).
  it("never sets two widths or two white-space values at the same variant in one class list", () => {
    const componentFiles = listFiles(SRC).filter((file) =>
      file.endsWith(".tsx"),
    );
    expect(findClassListConflicts(componentFiles, WEB_ROOT)).toEqual([]);
  });

  it("keeps width and white-space out of the base classes of primitives that accept className", () => {
    const primitiveFiles = listFiles(path.join(SRC, "components", "ui")).filter(
      (file) => file.endsWith(".tsx"),
    );
    expect(findPrimitiveBaseClassConflicts(primitiveFiles, WEB_ROOT)).toEqual(
      [],
    );
  });
});

describe("R7 headers and the browser error collector (21 §4 J4 points 3 and 5)", () => {
  const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const COLLECTOR = "src/observability/error-collector.ts";

  it("sends the security headers of R7 on every path", async () => {
    const { default: config, SECURITY_HEADERS } =
      await import("../next.config");
    expect(await config.headers?.()).toEqual([
      { source: "/:path*", headers: [...SECURITY_HEADERS] },
    ]);
    const byName = Object.fromEntries(
      SECURITY_HEADERS.map((header) => [header.key, header.value]),
    );
    expect(byName).toMatchObject({
      "X-Frame-Options": "DENY",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
    });
    expect(byName["Content-Security-Policy"]).toContain(
      "frame-ancestors 'none'",
    );
  });

  it("builds the CSP of 03 §6.5 with a nonce, without 'unsafe-inline' (18 T10.3)", async () => {
    const { contentSecurityPolicy, createNonce } =
      await import("../src/config/security-headers");
    const nonce = createNonce();
    expect(nonce).not.toBe(createNonce());
    const directives = contentSecurityPolicy(nonce).split("; ");
    expect(directives).toContain(
      `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    );
    expect(directives).toContain(`style-src 'self' 'nonce-${nonce}'`);
    expect(contentSecurityPolicy(nonce)).not.toMatch(/unsafe-/);
    expect(contentSecurityPolicy()).not.toMatch(
      /nonce-|unsafe-|strict-dynamic/,
    );
  });

  it("is never indexed outside production (J4S-3)", async () => {
    const { securityHeadersFor, NOINDEX } = await import("../next.config");
    const robots = (environment: string | undefined) =>
      securityHeadersFor(environment).find(
        (header) => header.key === "X-Robots-Tag",
      )?.value;
    expect(robots(undefined)).toBe(NOINDEX);
    expect(robots("staging")).toBe(NOINDEX);
    expect(robots("production")).toBeUndefined();
  });

  it("keeps the collector identical to that of apps/backoffice", () => {
    expect(readFileSync(path.join(WEB, COLLECTOR))).toEqual(
      readFileSync(path.join(WEB, "..", "backoffice", COLLECTOR)),
    );
  });

  it("never mounts the collector on the landing (02 §20.5)", () => {
    const landing = [
      path.join(WEB, "src/app/[locale]/page.tsx"),
      ...readdirSync(path.join(WEB, "src/components/landing"), {
        recursive: true,
      })
        .map(String)
        .filter((file) => /\.tsx?$/.test(file))
        .map((file) => path.join(WEB, "src/components/landing", file)),
    ];
    const importers = landing.filter((file) =>
      readFileSync(file, "utf8").includes("observability"),
    );
    expect(importers).toEqual([]);
  });
});
