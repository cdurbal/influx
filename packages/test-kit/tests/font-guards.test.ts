// Self-checks of the font guard G4f (docs/mvp/18-plan-de-test-mvp.md §5.1, TD1.9; 02 §21.4): a
// detector that no longer detects is a guard that lies.
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  findCharterFileCopies,
  findFontViolations,
  FONT_PRELOAD_PINNED_BYTES,
  FONTS_DIRECTORY,
  parseFontManifest,
  findTokensImportViolations,
} from "../src/guards.ts";

const REAL_PACKAGE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../ui",
);
const TEMP_ROOT = mkdtempSync(path.join(tmpdir(), "influx-font-guards-"));
let front = "";
let counter = 0;

/** A fresh copy of the real fonts directory and fonts.ts of packages/ui. */
beforeEach(() => {
  front = path.join(TEMP_ROOT, `front-${(counter += 1)}`);
  mkdirSync(path.join(front, "src/styles"), { recursive: true });
  cpSync(
    path.join(REAL_PACKAGE, FONTS_DIRECTORY),
    path.join(front, FONTS_DIRECTORY),
    { recursive: true },
  );
  cpSync(
    path.join(REAL_PACKAGE, "src/styles/fonts.ts"),
    path.join(front, "src/styles/fonts.ts"),
  );
});

afterAll(() => {
  rmSync(TEMP_ROOT, { recursive: true, force: true });
});

const inFonts = (name: string) => path.join(front, FONTS_DIRECTORY, name);
const LATIN = "manrope-latin-wght-normal.woff2";

describe("G4f font manifest and files", () => {
  it("accepts the real fonts directory of packages/ui", () => {
    expect(findFontViolations(front)).toEqual([]);
    expect(FONT_PRELOAD_PINNED_BYTES).toBeLessThanOrEqual(120_000);
  });

  it("reads the four rows of the manifest", () => {
    const rows = parseFontManifest(
      "| File |\n|---|\n| `a.woff2` | A | latin | src | abc | 200-800 | yes | `OFL-A.txt` |\n",
    );
    expect(rows).toEqual([
      {
        file: "a.woff2",
        subset: "latin",
        sha256: "abc",
        preloaded: true,
        license: "OFL-A.txt",
      },
    ]);
  });

  it("detects a modified file (SHA-256) and a wrong signature", () => {
    writeFileSync(inFonts(LATIN), Buffer.from("wOF2 modified"));
    expect(findFontViolations(front).join("\n")).toContain("SHA-256 differs");
    writeFileSync(inFonts(LATIN), Buffer.from("not a font"));
    expect(findFontViolations(front).join("\n")).toContain("signature");
  });

  it("detects a font that is not listed and a listed font that is absent", () => {
    writeFileSync(inFonts("extra.woff2"), Buffer.from("wOF2"));
    expect(findFontViolations(front).join("\n")).toContain(
      "extra.woff2: not listed",
    );
    rmSync(inFonts("extra.woff2"));
    rmSync(inFonts(LATIN));
    expect(findFontViolations(front).join("\n")).toContain(
      `${LATIN}: listed in the manifest, absent`,
    );
  });

  it("detects a font outside src/styles/fonts/ and a missing manifest", () => {
    mkdirSync(path.join(front, "public"), { recursive: true });
    writeFileSync(path.join(front, "public/stray.woff2"), Buffer.from("wOF2"));
    expect(findFontViolations(front).join("\n")).toContain(
      "public/stray.woff2: font outside",
    );
    rmSync(inFonts("FONTS.md"));
    expect(findFontViolations(front).join("\n")).toContain("missing manifest");
  });

  it("detects a missing or foreign license", () => {
    writeFileSync(inFonts("OFL-Manrope.txt"), "MIT");
    expect(findFontViolations(front).join("\n")).toContain(
      "not the SIL Open Font License",
    );
    rmSync(inFonts("OFL-Manrope.txt"));
    expect(findFontViolations(front).join("\n")).toContain("is absent");
  });

  it("detects a preload budget that moved off its pin", () => {
    const grown = Buffer.concat([
      readFileSync(inFonts(LATIN)),
      Buffer.alloc(10),
    ]);
    writeFileSync(inFonts(LATIN), grown);
    expect(findFontViolations(front).join("\n")).toContain("the pin is");
  });
});

describe("G4f copies in a front (arbitration PL-07)", () => {
  it("accepts a front without any copy and detects each file of packages/ui copied back", () => {
    const other = path.join(TEMP_ROOT, "other");
    mkdirSync(path.join(other, "src/styles"), { recursive: true });
    writeFileSync(path.join(other, "src/styles/image-sizes.ts"), "// kept\n");
    expect(findCharterFileCopies(other)).toEqual([]);
    writeFileSync(path.join(other, "src/styles/fonts.ts"), "// copy\n");
    writeFileSync(path.join(other, "src/styles/tokens.css"), "/* copy */\n");
    mkdirSync(path.join(other, FONTS_DIRECTORY), { recursive: true });
    expect(findCharterFileCopies(other)).toEqual([
      "src/styles/tokens.css: copy of a file of packages/ui",
      "src/styles/fonts.ts: copy of a file of packages/ui",
      `${FONTS_DIRECTORY}: copy of a file of packages/ui`,
    ]);
  });

  it("detects a font file anywhere in src/ or public/ of a front", () => {
    const other = path.join(TEMP_ROOT, "other-fonts");
    mkdirSync(path.join(other, "public"), { recursive: true });
    mkdirSync(path.join(other, "src/assets"), { recursive: true });
    writeFileSync(path.join(other, "public/stray.woff2"), Buffer.from("wOF2"));
    writeFileSync(path.join(other, "src/assets/old.woff"), Buffer.from("wOFF"));
    expect(findCharterFileCopies(other)).toEqual([
      "src/assets/old.woff: font file in a front (packages/ui holds them)",
      "public/stray.woff2: font file in a front (packages/ui holds them)",
    ]);
  });
});

describe("G4f tokens import (arbitration PL-07)", () => {
  it("accepts the sheets named and detects a sheet that lost or gained the import", () => {
    const other = path.join(TEMP_ROOT, "other-sheets");
    const sheet = "src/app/globals.css";
    const local = path.join(other, "src/styles/local.css");
    mkdirSync(path.join(other, "src/app"), { recursive: true });
    mkdirSync(path.join(other, "src/styles"), { recursive: true });
    writeFileSync(
      path.join(other, sheet),
      '@import "tailwindcss";\n@import "@influx/ui/tokens.css";\n',
    );
    writeFileSync(local, "/* none */\n");
    expect(findTokensImportViolations(other, [sheet])).toEqual([]);
    writeFileSync(local, '@import "@influx/ui/tokens.css";\n');
    expect(findTokensImportViolations(other, [sheet])).toEqual([
      `@influx/ui/tokens.css is imported in [${sheet}, src/styles/local.css], expected [${sheet}]`,
    ]);
    writeFileSync(path.join(other, sheet), '@import "../styles/tokens.css";\n');
    expect(findTokensImportViolations(other, [sheet])).toEqual([
      `@influx/ui/tokens.css is imported in [src/styles/local.css], expected [${sheet}]`,
    ]);
  });
});
