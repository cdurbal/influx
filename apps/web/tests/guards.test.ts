// Guard tests of the landing page mockup (docs/landing-page/01-architecture.md §9.3).
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
const PLACEHOLDERS_DIR = path.join(SRC, "content", "placeholders");
const IMAGES_DIR = path.join(PLACEHOLDERS_DIR, "images");

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

describe("G1: no mailto or tel shortcut (CA6, revised 00-cadrage.md §8)", () => {
  // href= itself was reintroduced on 2026-09-17 for in-app navigation between the account/login
  // pages (docs/landing-page/00-cadrage.md §8): only the CA6, no-href part is abrogated. Direct
  // mailto:/tel: shortcuts stay forbidden — the contact e-mail remains plain text (CA6 residual).
  it("finds no mailto: or tel:", () => {
    expect(findMatches(/mailto:|\btel:/, SCOPED_FILES)).toEqual([]);
  });
});

describe("G2: no third-party URL (CA11)", () => {
  it("finds no http:// or https:// URL", () => {
    expect(findMatches(/https?:\/\//, SCOPED_FILES)).toEqual([]);
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

describe("G4: every photo is credited, and every credit has a photo (CA26)", () => {
  const images = readdirSync(IMAGES_DIR).sort();
  const credits = readFileSync(
    path.join(PLACEHOLDERS_DIR, "CREDITS.md"),
    "utf8",
  );
  const creditedFiles = [...credits.matchAll(/^\|\s*(img-[\w-]+\.jpg)\s*\|/gm)]
    .map((match) => match[1])
    .sort();

  it("lists the 31 photos of 05-images.md", () => {
    expect(images).toHaveLength(31);
  });

  it("matches the image folder and CREDITS.md exactly", () => {
    expect(creditedFiles).toEqual(images);
  });

  it("gives an author, a Pexels source page and the license for each photo", () => {
    for (const file of images) {
      // Table cells may be padded by Prettier: compare trimmed first cells.
      const line = credits
        .split("\n")
        .find((row) => row.split("|")[1]?.trim() === file);
      expect(line, file).toBeDefined();
      expect(line, file).toMatch(/https:\/\/www\.pexels\.com\/@/);
      expect(line, file).toMatch(/https:\/\/www\.pexels\.com\/photo\//);
      expect(line, file).toContain("Licence Pexels");
    }
  });

  it("keeps no photo in public/ (01 §6.1, 05 §5)", () => {
    const publicDir = path.join(WEB_ROOT, "public");
    const publicImages = existsSync(publicDir)
      ? listFiles(publicDir).filter((file) =>
          /\.(jpe?g|png|webp|avif|gif)$/i.test(file),
        )
      : [];
    expect(publicImages).toEqual([]);
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

describe("G6: the mockup banner cannot be hidden while fictitious content exists (CA13, CA14)", () => {
  it("keeps IS_MOCKUP set to true", () => {
    const source = readFileSync(
      path.join(PLACEHOLDERS_DIR, "index.ts"),
      "utf8",
    );
    expect(source).toMatch(/export const IS_MOCKUP: boolean = true;/);
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

  it("keeps fictitious values inside src/content/placeholders only (CA15)", () => {
    const outside = listFiles(SRC).filter(
      (file) =>
        !file.startsWith(PLACEHOLDERS_DIR) && /\.(ts|tsx|json|css)$/.test(file),
    );
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
    ];
    // Comments may name the fictitious module: only code and messages are checked.
    const stripComments = (source: string) =>
      source
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|[^:])\/\/.*$/gm, "$1");
    const leaks = outside.flatMap((file) => {
      const content = stripComments(readFileSync(file, "utf8"));
      return fictitiousValues
        .filter((value) => content.includes(value))
        .map((value) => `${relative(file)}: ${value}`);
    });
    expect(leaks).toEqual([]);
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

  it("imports the fictitious module only from the locale layout and page (CA15)", () => {
    const importers = listFiles(SRC)
      .filter(
        (file) => !file.startsWith(PLACEHOLDERS_DIR) && /\.tsx?$/.test(file),
      )
      .filter((file) =>
        /from "[^"]*placeholders[^"]*"/.test(readFileSync(file, "utf8")),
      )
      .map(relative)
      .sort();
    expect(importers).toEqual([
      "src/app/[locale]/layout.tsx",
      "src/app/[locale]/page.tsx",
    ]);
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
