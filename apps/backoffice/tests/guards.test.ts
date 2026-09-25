// Guard tests of apps/backoffice (docs/mvp/18-plan-de-test-mvp.md §5, docs/mvp/21 §4 J1-C and
// J1-E). File reading only: deterministic, no browser, no network. Detectors: @influx/test-kit.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  findClassListConflicts,
  findMatches,
  findNetworkOrStorageUse,
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
} from "@influx/test-kit/guards";
import { describe, expect, it } from "vitest";
import nextConfig, { NOINDEX } from "../next.config";

const BACKOFFICE_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const WEB_ROOT = path.resolve(BACKOFFICE_ROOT, "..", "web");
const SRC = path.join(BACKOFFICE_ROOT, "src");
const TOKENS = "src/styles/tokens.css";

const SOURCE_FILES = listFiles(SRC).filter((file) =>
  /\.(ts|tsx|json|css)$/.test(file),
);

function relative(file: string): string {
  return relativePath(BACKOFFICE_ROOT, file);
}

describe("G3: no hard-coded color or length outside the token file (CA22)", () => {
  const files = SOURCE_FILES.filter((file) => relative(file) !== TOKENS);

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
    expect(cssFiles).toEqual(["src/app/globals.css", TOKENS]);
    expect(
      readFileSync(path.join(SRC, "app", "globals.css"), "utf8"),
    ).not.toMatch(/--color-[\w-]+\s*:/);
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

  it("uses no storage API, and no network API outside the API client", () => {
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
      "src/messages/fr.ts",
    ]);
    expect(existsSync(path.join(SRC, "locales"))).toBe(false);
    expect(SOURCE_FILES.filter((file) => file.endsWith(".json"))).toEqual([]);
  });
});

describe("never indexed (03 §7.1, D12)", () => {
  it("sends X-Robots-Tag on every path", async () => {
    expect(NOINDEX).toBe("noindex, nofollow, noarchive");
    expect(await nextConfig.headers?.()).toEqual([
      {
        source: "/:path*",
        headers: [{ key: "X-Robots-Tag", value: NOINDEX }],
      },
    ]);
  });
});
