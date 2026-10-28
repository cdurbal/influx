// Guard tests of apps/backoffice (docs/mvp/18-plan-de-test-mvp.md §5, docs/mvp/21 §4 J1-C and
// J1-E). File reading only: deterministic, no browser, no network. Detectors: @influx/test-kit.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  BROWSER_RELAY_CLIENT_FILE,
  findBrowserRelayClientMismatches,
  findClassListConflicts,
  findMatches,
  findNetworkOrStorageUse,
  findPagesRouterDirectories,
  findPrimitiveBaseClassConflicts,
  findRelayContentViolations,
  findRelayFingerprintMismatches,
  findRelayImporterViolations,
  findRouteFileViolations,
  HARD_CODED_COLOR_PATTERN,
  HARD_CODED_LENGTH_PATTERN,
  importSpecifiers,
  listFiles,
  RELAY_FILES,
  relativePath,
  effectiveTokens,
  findFontViolations,
  findNonBoDeclarations,
  findTokenPairFailures,
  DANGER_RED_TOKENS,
  OPAQUE_TOKEN_VALUE,
  TRANSLUCENT_RED_CLASS,
  type Charter,
} from "@influx/test-kit/guards";
import { DANGER_PAIRS } from "@influx/test-kit/charter-data";
import { describe, expect, it } from "vitest";
import nextConfig, { NOINDEX, SECURITY_HEADERS } from "../next.config";
import {
  contentSecurityPolicy,
  createNonce,
} from "../src/config/security-headers";

const BACKOFFICE_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const WEB_ROOT = path.resolve(BACKOFFICE_ROOT, "..", "web");
const SRC = path.join(BACKOFFICE_ROOT, "src");
const TOKENS = "src/styles/tokens.css";
/** The backoffice-only tokens (D73, 02 §21.3 point 6): born with DS-9, a token file like the other. */
const TOKENS_BACKOFFICE = "src/styles/tokens-backoffice.css";

const SOURCE_FILES = listFiles(SRC).filter((file) =>
  /\.(ts|tsx|json|css)$/.test(file),
);

function relative(file: string): string {
  return relativePath(BACKOFFICE_ROOT, file);
}

/** The only label module while D36 is open (18 §5 annex 1, EC-25). */
const LABEL_MODULE = "src/messages/fr.ts";

/** A language code, with or without a region, and with or without an extension: en, pt-BR.ts… */
const LANGUAGE_NAME = /^(?:fr|en|pt|es|de|it)(?:[-_][a-z]{2,4})?(?:\.\w+)?$/i;

/** Directories of translation files, forbidden anywhere under src/. */
const TRANSLATION_DIRECTORIES = new Set(["locales", "i18n"]);

/**
 * Relative paths under src/ that hold a language-named file or directory, or a translation
 * directory. The label module itself is the only exception.
 */
function languageNamedPaths(paths: readonly string[]): string[] {
  return paths.filter(
    (file) =>
      file !== LABEL_MODULE &&
      file
        .split("/")
        .slice(1)
        .some(
          (segment) =>
            LANGUAGE_NAME.test(segment) || TRANSLATION_DIRECTORIES.has(segment),
        ),
  );
}

// G1 tightened at J9 commit 5 (18 §5 G1): the back office has no legal or contact page, so no
// mailto: or tel: link anywhere, without an allowlist.
describe("G1: no mailto or tel link (18 §5 G1)", () => {
  it("finds no mailto: or tel:", () => {
    expect(
      findMatches(/mailto:|\btel:/, SOURCE_FILES, BACKOFFICE_ROOT),
    ).toEqual([]);
  });
});

describe("G3: no hard-coded color or length outside the token file (CA22)", () => {
  const files = SOURCE_FILES.filter(
    (file) => ![TOKENS, TOKENS_BACKOFFICE].includes(relative(file)),
  );

  it("finds no hexadecimal color or color function", () => {
    expect(
      findMatches(HARD_CODED_COLOR_PATTERN, files, BACKOFFICE_ROOT),
    ).toEqual([]);
  });

  it("finds no literal length (px, rem, em, vh, vw, ch)", () => {
    expect(
      findMatches(HARD_CODED_LENGTH_PATTERN, files, BACKOFFICE_ROOT),
    ).toEqual([]);
  });

  it("keeps a byte-for-byte copy of the apps/web tokens until packages/ui exists (J1-E)", () => {
    expect(readFileSync(path.join(BACKOFFICE_ROOT, TOKENS))).toEqual(
      readFileSync(path.join(WEB_ROOT, TOKENS)),
    );
  });

  it("keeps globals.css and tokens.css as the only style sheets, colors in tokens only", () => {
    const cssFiles = listFiles(SRC)
      .filter((file) => file.endsWith(".css"))
      .map(relative)
      .sort();
    expect(cssFiles.filter((file) => file !== TOKENS_BACKOFFICE)).toEqual([
      "src/app/globals.css",
      TOKENS,
    ]);
    expect(
      readFileSync(path.join(SRC, "app", "globals.css"), "utf8"),
    ).not.toMatch(/--color-[\w-]+\s*:/);
  });
});

describe("G3b: the red of danger is opaque and shared by both fronts and both charters (zone-de-danger fiche §5, D73)", () => {
  const tokens = readFileSync(path.join(SRC, "styles", "tokens.css"), "utf8");
  const other = readFileSync(
    path.join(WEB_ROOT, "src", "styles", "tokens.css"),
    "utf8",
  );
  const value = (css: string, charter: Charter, name: string): string =>
    effectiveTokens(css, charter).get(name) ?? "";

  // The backoffice is KEO whole (D73), but its file is the vitrine's byte for byte: both charters
  // are read, and the KEO one is the one this front shows.
  for (const charter of ["vitrine", "keo"] as const) {
    it(`gives every danger token a 6-digit hex, transparent or var() value (${charter})`, () => {
      for (const name of DANGER_RED_TOKENS) {
        expect(value(tokens, charter, name), name).toMatch(OPAQUE_TOKEN_VALUE);
      }
    });

    it(`has the same values as the other front (${charter})`, () => {
      for (const name of DANGER_RED_TOKENS) {
        expect(value(other, charter, name), name).toBe(
          value(tokens, charter, name),
        );
      }
    });

    it(`keeps the contrast ratios of §5, recomputed from the file (${charter})`, () => {
      expect(
        findTokenPairFailures(effectiveTokens(tokens, charter), DANGER_PAIRS),
      ).toEqual([]);
    });
  }

  it("tints no red with an opacity modifier or a color function", () => {
    expect(
      findMatches(TRANSLUCENT_RED_CLASS, SOURCE_FILES, BACKOFFICE_ROOT),
    ).toEqual([]);
  });
});

// G3f (D73, 18 §5.1, 02 §21.3 point 6): tokens-backoffice.css, once it exists (DS-9), declares
// `--*-bo-*` names only. The other half (no -bo- name in apps/web) is in apps/web/tests.
describe("G3f: tokens-backoffice.css holds backoffice tokens only", () => {
  const file = path.join(SRC, "styles", "tokens-backoffice.css");

  it("declares nothing but -bo- names (vacuous until the file exists)", () => {
    expect(
      existsSync(file) ? findNonBoDeclarations(readFileSync(file, "utf8")) : [],
    ).toEqual([]);
  });
});

describe("G7: no Tailwind class conflict that cn() cannot resolve (10 #10)", () => {
  it("never sets two widths or two white-space values at the same variant in one class list", () => {
    const componentFiles = listFiles(SRC).filter((file) =>
      file.endsWith(".tsx"),
    );
    expect(findClassListConflicts(componentFiles, BACKOFFICE_ROOT)).toEqual([]);
  });

  it("keeps width and white-space out of the base classes of primitives", () => {
    const primitivesDir = path.join(SRC, "components", "ui");
    const primitiveFiles = existsSync(primitivesDir)
      ? listFiles(primitivesDir).filter((file) => file.endsWith(".tsx"))
      : [];
    expect(
      findPrimitiveBaseClassConflicts(primitiveFiles, BACKOFFICE_ROOT),
    ).toEqual([]);
  });
});

describe("the relay is the only server endpoint (21 J1-C, 03 PP-12)", () => {
  it("has exactly one route file under src/app: the relay", () => {
    expect(findRouteFileViolations(BACKOFFICE_ROOT)).toEqual([]);
  });

  it("has no Pages Router directory, pages/ nor src/pages/ (18 §5 G5 b)", () => {
    expect(findPagesRouterDirectories(BACKOFFICE_ROOT)).toEqual([]);
  });

  it("keeps data-layer imports, Server Actions and environment reads out of the relay", () => {
    expect(findRelayContentViolations(BACKOFFICE_ROOT)).toEqual([]);
  });

  it("reaches the API client along a single chain: route, relay, API client, config", () => {
    expect(findRelayImporterViolations(BACKOFFICE_ROOT)).toEqual([]);
  });

  it("matches the pinned SHA-256 of the four relay files (T7.8)", () => {
    expect(findRelayFingerprintMismatches(BACKOFFICE_ROOT)).toEqual([]);
  });

  it("keeps the four relay files identical to those of apps/web", () => {
    for (const file of Object.values(RELAY_FILES)) {
      expect(readFileSync(path.join(BACKOFFICE_ROOT, file)), file).toEqual(
        readFileSync(path.join(WEB_ROOT, file)),
      );
    }
  });

  it("pins the browser relay client and keeps it identical to that of apps/web (J3 commit 12)", () => {
    expect(findBrowserRelayClientMismatches(BACKOFFICE_ROOT)).toEqual([]);
    expect(
      readFileSync(path.join(BACKOFFICE_ROOT, BROWSER_RELAY_CLIENT_FILE)),
    ).toEqual(readFileSync(path.join(WEB_ROOT, BROWSER_RELAY_CLIENT_FILE)));
  });

  it("uses no storage API, and no network API outside the API client and the relay client", () => {
    const codeFiles = SOURCE_FILES.filter((file) => /\.tsx?$/.test(file));
    expect(findNetworkOrStorageUse(codeFiles, BACKOFFICE_ROOT)).toEqual([]);
  });
});

describe("French only while D36 is open (02 §8, 18 §5 annex 1)", () => {
  it("does not depend on next-intl", () => {
    const manifest = JSON.parse(
      readFileSync(path.join(BACKOFFICE_ROOT, "package.json"), "utf8"),
    ) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    expect(Object.keys(manifest.dependencies ?? {})).not.toContain("next-intl");
    expect(Object.keys(manifest.devDependencies ?? {})).not.toContain(
      "next-intl",
    );
    const importers = SOURCE_FILES.filter((file) =>
      importSpecifiers(readFileSync(file, "utf8")).some((specifier) =>
        /^next-intl(?:\/|$)/.test(specifier),
      ),
    ).map(relative);
    expect(importers).toEqual([]);
  });

  it("has a single label module, in French, and no translation file", () => {
    expect(listFiles(path.join(SRC, "messages")).map(relative)).toEqual([
      LABEL_MODULE,
    ]);
    expect(existsSync(path.join(SRC, "locales"))).toBe(false);
    expect(SOURCE_FILES.filter((file) => file.endsWith(".json"))).toEqual([]);
  });

  // 18 §5 annex 1 (a) and (b), EC-25 widened by 21 J1-J T-4.
  it("names no other file or directory of src/ after a language, and has no locales/ nor i18n/", () => {
    expect(languageNamedPaths(listFiles(SRC).map(relative))).toEqual([]);
  });

  it("detects a language-named path (self-check of the detector)", () => {
    expect(
      languageNamedPaths([
        LABEL_MODULE,
        "src/i18n/en.ts",
        "src/labels/pt-BR.ts",
        "src/labels/fr_FR.ts",
        "src/en/labels.ts",
        "src/app/locales/x.ts",
        "src/app/page.tsx",
        "src/server/relay.ts",
        "src/labels/french.ts",
      ]),
    ).toEqual([
      "src/i18n/en.ts",
      "src/labels/pt-BR.ts",
      "src/labels/fr_FR.ts",
      "src/en/labels.ts",
      "src/app/locales/x.ts",
    ]);
  });
});

describe("never indexed (03 §7.1, D12)", () => {
  it("sends X-Robots-Tag and the security headers of R7 on every path", async () => {
    expect(NOINDEX).toBe("noindex, nofollow, noarchive");
    expect(await nextConfig.headers?.()).toEqual([
      { source: "/:path*", headers: [...SECURITY_HEADERS] },
    ]);
    const byName = Object.fromEntries(
      SECURITY_HEADERS.map((header) => [header.key, header.value]),
    );
    expect(byName).toMatchObject({
      "X-Robots-Tag": NOINDEX,
      "X-Frame-Options": "DENY",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    });
    expect(byName["Content-Security-Policy"]).toContain(
      "frame-ancestors 'none'",
    );
    expect(byName["Strict-Transport-Security"]).toMatch(/^max-age=\d{8,}/);
  });

  it("builds the stricter CSP of 03 §6.5: a nonce, no Supabase host (18 T10.2, T10.3, J3S-7)", () => {
    const nonce = createNonce();
    expect(nonce).not.toBe(createNonce());
    const directives = contentSecurityPolicy(nonce).split("; ");
    expect(directives).toContain(`script-src 'self' 'nonce-${nonce}'`);
    expect(directives).toContain(`style-src 'self' 'nonce-${nonce}'`);
    expect(directives).toContain("img-src 'self' blob:");
    expect(contentSecurityPolicy(nonce)).not.toMatch(/unsafe-|supabase/);
  });
});

// G4f (D73, 18 §5.1, TD1.9): self-hosted fonts. Identity with apps/web is checked from the web side.
describe("G4f: fonts are unmodified, listed, licensed and within budget", () => {
  it("finds no violation in the fonts directory of apps/backoffice", () => {
    expect(findFontViolations(BACKOFFICE_ROOT)).toEqual([]);
  });
});
