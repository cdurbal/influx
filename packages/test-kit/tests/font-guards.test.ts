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
  findFontCopyDivergences,
  findFontViolations,
  FONT_PRELOAD_PINNED_BYTES,
  FONTS_DIRECTORY,
  parseFontManifest,
} from "../src/guards.ts";

const REAL_FRONT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../apps/web",
);
const TEMP_ROOT = mkdtempSync(path.join(tmpdir(), "influx-font-guards-"));
let front = "";
let counter = 0;

/** A fresh copy of the real fonts directory and fonts.ts of apps/web. */
beforeEach(() => {
  front = path.join(TEMP_ROOT, `front-${(counter += 1)}`);
  mkdirSync(path.join(front, "src/styles"), { recursive: true });
  cpSync(
    path.join(REAL_FRONT, FONTS_DIRECTORY),
    path.join(front, FONTS_DIRECTORY),
    { recursive: true },
  );
  cpSync(
    path.join(REAL_FRONT, "src/styles/fonts.ts"),
    path.join(front, "src/styles/fonts.ts"),
  );
});

afterAll(() => {
  rmSync(TEMP_ROOT, { recursive: true, force: true });
});

const inFonts = (name: string) => path.join(front, FONTS_DIRECTORY, name);
const LATIN = "manrope-latin-wght-normal.woff2";

describe("G4f font manifest and files", () => {
  it("accepts the real fonts directory", () => {
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

describe("G4f copies between fronts", () => {
  it("accepts identical copies and detects a divergence or a missing file", () => {
    const other = path.join(TEMP_ROOT, "other");
    cpSync(front, other, { recursive: true });
    expect(findFontCopyDivergences(front, other)).toEqual([]);
    writeFileSync(path.join(other, "src/styles/fonts.ts"), "// changed\n");
    expect(findFontCopyDivergences(front, other)).toEqual([
      "src/styles/fonts.ts: differs between the two fronts",
    ]);
    rmSync(path.join(other, FONTS_DIRECTORY, "FONTS.md"));
    expect(findFontCopyDivergences(front, other)).toContain(
      `${FONTS_DIRECTORY}/FONTS.md: present in only one front`,
    );
  });
});
