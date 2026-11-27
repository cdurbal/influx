// RUA-03 (jalons/rua/03.md, modele-archi.md §5; 22-refonte-ux-ui/05 §1 to §3): the mockup comparison
// tool without a browser. The comparators of N1 and N2 and their tolerances, the options and masks
// of N3, the manifest of the frozen mockups (954e009) and the 147 states of the survey, RU-19 refused
// by the data, the couples (the member shell's from RUB line 11, screen × state of its mockup, A §6),
// the `visual` project defined only under E2E_VISUAL, its `app` spec apart, and no
// image under apps/web/e2e. File reading only: deterministic, run by `pnpm test` in CI.
import { createHash } from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CASE_FLOORS as APP_CASE_FLOORS } from "../e2e/visual/app-case-floors";
import {
  expectedDifferences,
  SUBMITTED_DEVIATIONS,
} from "../e2e/visual/app-deviations";
import { CASE_FLOORS as MOCKUP_CASE_FLOORS } from "../e2e/visual/case-floors";
import {
  canonicalFamily,
  compareStructure,
  compareStyleRecord,
  compareStyles,
  isMaskKind,
  MASK_KINDS,
  N2_TOLERANCES,
  N3_SCREENSHOT_OPTIONS,
  normalizedAria,
  sameColor,
  withoutBorderOfNoWidth,
  zonesOf,
  type StyleRecord,
  type VisualColor,
} from "../e2e/support/visual/compare";
import {
  coupleProblems,
  VISUAL_COUPLES,
  type VisualCouple,
} from "../e2e/support/visual/couples";
import {
  FAMILY_SAMPLES,
  MOCKUP_COMMIT,
  MOCKUP_DIRECTORY,
  MOCKUP_MANIFEST,
  MOCKUPS,
  mockupOf,
  statesOf,
  SURVEY_COUNTS,
  surveyCaptures,
  VISUAL_WINDOWS,
  visualWindowRefusal,
} from "../e2e/support/visual/mockups";

const WEB_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

/** The parse of `rgbaOf` (e2e/support/rendering.ts) for the two serializations of Chromium. */
function color(r: number, g: number, b: number, a = 1): VisualColor {
  return { r, g, b, a };
}

function record(overrides: Partial<StyleRecord> = {}): StyleRecord {
  return {
    probe: "heading",
    rank: 0,
    tag: "h1",
    colors: {
      color: color(240, 244, 242),
      "background-color": color(0, 0, 0, 0),
    },
    exact: { "font-size": "32px", "line-height": "40px", "padding-top": "0px" },
    family: "manrope",
    familyLoaded: true,
    stacking: { position: "static", zIndex: "auto" },
    box: { x: 240, y: 96, width: 640, height: 40 },
    ...overrides,
  };
}

describe("N1: structure and texts (05 §3)", () => {
  const aria = [
    '- navigation "Navigation principale":',
    '  - link "Accueil"',
    "- main:",
    '  - heading "Accueil" [level=1]',
    "  - text: 12 profils correspondent",
  ].join("\n");

  it("finds no difference between a page and itself", () => {
    expect(
      compareStructure({ aria, icons: ["home"] }, { aria, icons: ["home"] }),
    ).toEqual([]);
  });

  it("sees a wording that changed", () => {
    const differences = compareStructure(
      { aria, icons: [] },
      {
        aria: aria.replace('"Accueil" [level=1]', '"Accueil !" [level=1]'),
        icons: [],
      },
    );
    expect(differences).toHaveLength(1);
    expect(differences[0]).toMatch(/^aria line 4: .*Accueil !/);
  });

  it("excludes the {variable} values, and only them", () => {
    const other = aria.replace("12 profils", "40 profils");
    expect(
      compareStructure({ aria, icons: [] }, { aria: other, icons: [] }, [
        /\d+ profils/,
      ]),
    ).toEqual([]);
    expect(
      compareStructure({ aria, icons: [] }, { aria: other, icons: [] }),
    ).toHaveLength(1);
    expect(
      normalizedAria("- text: 12 profils, 3 profils", [/\d+ profils/]),
    ).toEqual(["- text: {variable}, {variable}"]);
  });

  it("sees the zones in another order", () => {
    const swapped = [
      "- main:",
      '  - heading "Accueil" [level=1]',
      "  - text: 12 profils correspondent",
      '- navigation "Navigation principale":',
      '  - link "Accueil"',
    ].join("\n");
    expect(zonesOf(normalizedAria(aria))).toEqual([
      'navigation "Navigation principale"',
      "main",
    ]);
    const differences = compareStructure(
      { aria, icons: [] },
      { aria: swapped, icons: [] },
    );
    expect(differences[0]).toBe(
      'zones: navigation "Navigation principale" | main → main | navigation "Navigation principale"',
    );
  });

  it("counts a line added or removed once, without shifting the lines after it (RUB-11)", () => {
    const added = aria.replace(
      "- main:",
      ['  - link "Campagnes"', "- main:"].join("\n"),
    );
    expect(
      compareStructure({ aria, icons: [] }, { aria: added, icons: [] }),
    ).toEqual(['aria line 3: null → "  - link \\"Campagnes\\""']);
    expect(
      compareStructure({ aria: added, icons: [] }, { aria, icons: [] }),
    ).toEqual(['aria line 3: "  - link \\"Campagnes\\"" → null']);
    // A button that became a link: its line differs, the link's address is one line more.
    expect(
      compareStructure(
        { aria: '- button "English"\n- main', icons: [] },
        { aria: '- link "English":\n  - /url: /en\n- main', icons: [] },
      ),
    ).toEqual([
      'aria line 1: "- button \\"English\\"" → "- link \\"English\\":"',
      'aria line 2: null → "  - /url: /en"',
    ]);
  });

  it("drops an unnamed image and a text repeating its holder's name, keeps any other (RUB-11)", () => {
    // A mockup's link holds its icon (`<svg>` in the tree) and its text; the application's, its
    // text alone (icon `aria-hidden`): the same link, the icons compared apart.
    const mockup = [
      '- link "Accueil":',
      '  - /url: "#contenu"',
      "  - img",
      "  - text: Accueil",
    ].join("\n");
    const app = ['- link "Accueil":', "  - /url: /fr/marque"].join("\n");
    expect(
      compareStructure(
        { aria: mockup, icons: ["house"] },
        { aria: app, icons: ["house"] },
        [/(?<=\/url: ).+/],
      ),
    ).toEqual([]);
    // Negative cases: a named image, a text other than the name, the same text out of its holder.
    expect(normalizedAria('- img "Logo"')).toEqual(['- img "Logo"']);
    expect(
      normalizedAria(['- link "Accueil":', "  - text: Accueil !"].join("\n")),
    ).toEqual(['- link "Accueil":', "  - text: Accueil !"]);
    expect(
      normalizedAria(
        ['- link "Accueil":', "  - /url: /", "- text: Accueil"].join("\n"),
      ),
    ).toEqual(['- link "Accueil":', "  - /url: /", "- text: Accueil"]);
  });

  it("sees an icon replaced or moved", () => {
    expect(
      compareStructure(
        { aria, icons: ["home", "search"] },
        { aria, icons: ["search", "home"] },
      ),
    ).toEqual(["icons: home,search → search,home"]);
  });
});

describe("N2: computed styles and geometry (05 §3)", () => {
  it("finds no difference between an element and itself", () => {
    expect(compareStyleRecord(record(), record())).toEqual([]);
  });

  it("equals color-mix and rgba at equal value, sees a channel off by one", () => {
    // `color(srgb 0.0392157 0.0784314 0.117647 / 0.5)` and `rgba(10, 20, 30, 0.5)`, as rgbaOf reads them.
    const mixed = color(0.0392157 * 255, 0.0784314 * 255, 0.117647 * 255, 0.5);
    expect(sameColor(mixed, color(10, 20, 30, 0.5))).toBe(true);
    expect(sameColor(mixed, color(11, 20, 30, 0.5))).toBe(false);
    expect(sameColor(color(10, 20, 30, 0.5), color(10, 20, 30, 0.51))).toBe(
      false,
    );
    expect(sameColor(null, null)).toBe(true);
    expect(sameColor(null, color(0, 0, 0))).toBe(false);
    const differences = compareStyleRecord(
      record(),
      record({ colors: { ...record().colors, color: color(241, 244, 242) } }),
    );
    expect(differences).toEqual([
      "heading[0] <h1> color: rgba(240, 244, 242, 1) → rgba(241, 244, 242, 1)",
    ]);
  });

  it("allows 1 px on a position, a width, a height; not 2", () => {
    expect(N2_TOLERANCES.geometryPx).toBe(1);
    const moved = (box: Partial<StyleRecord["box"]>) =>
      compareStyleRecord(
        record(),
        record({ box: { ...record().box, ...box } }),
      );
    expect(moved({ x: 241, width: 639.5, height: 41 })).toEqual([]);
    expect(moved({ x: 242 })).toEqual([
      "heading[0] <h1> x: 240 → 242 (2.00 px > 1 px)",
    ]);
    // A line more: a multiple of the line height, far beyond the pixel.
    expect(moved({ height: 80 })).toHaveLength(1);
  });

  it("has no tolerance on a size, a spacing, a line height", () => {
    for (const [property, value] of [
      ["font-size", "32.5px"],
      ["line-height", "41px"],
      ["padding-top", "1px"],
    ] as const) {
      expect(
        compareStyleRecord(
          record(),
          record({ exact: { ...record().exact, [property]: value } }),
        ),
        property,
      ).toHaveLength(1);
    }
  });

  it("sees another family, a family not loaded, another stacking", () => {
    expect(
      compareStyleRecord(record(), record({ family: "source sans 3" })),
    ).toEqual(["heading[0] <h1> font family: manrope → source sans 3"]);
    expect(
      compareStyleRecord(record(), record({ familyLoaded: false })),
    ).toEqual(["heading[0] <h1> font loaded: true → false"]);
    expect(
      compareStyleRecord(
        record(),
        record({ stacking: { position: "sticky", zIndex: "auto" } }),
      ),
    ).toEqual(["heading[0] <h1> stacking: static/auto → sticky/auto"]);
  });

  it("pairs the elements by rank and sees one missing on either side", () => {
    const second = record({ rank: 1, tag: "p" });
    expect(compareStyles([record(), second], [record(), second])).toEqual([]);
    expect(compareStyles([record(), second], [record()])).toEqual([
      "heading[1] <p>: missing from the candidate",
    ]);
    expect(compareStyles([record()], [record(), second])).toEqual([
      "heading[1] <p>: missing from the reference",
    ]);
  });

  it("reads a family of next/font and of a mockup alike, a fallback apart", () => {
    expect(canonicalFamily("__Manrope_3c2a1b")).toBe("manrope");
    expect(canonicalFamily('"Manrope"')).toBe("manrope");
    expect(canonicalFamily("__Source_Sans_3_a1b2c3")).toBe("source sans 3");
    expect(canonicalFamily("Source Sans 3")).toBe("source sans 3");
    expect(canonicalFamily("Manrope Fallback")).toBe("manrope fallback");
  });

  it("reads the constants of fonts.ts as their typeface, a closed list (RUB-11)", () => {
    expect(canonicalFamily("__SOURCE_SANS_LATIN_9f8e7d")).toBe("source sans 3");
    expect(canonicalFamily("__MANROPE_LATIN_EXT_9f8e7d")).toBe("manrope");
    expect(canonicalFamily("__SOURCE_SANS_LATIN_Fallback_9f8e7d")).toBe(
      "source sans latin fallback",
    );
    expect(canonicalFamily("Inter Latin")).toBe("inter latin");
  });

  it("reads a border of no width as no border, whatever its style and color; not a border of 1 px (RUB-11)", () => {
    const tailwind = record({
      exact: {
        "border-top-width": "0px",
        "border-top-style": "solid",
        "border-left-width": "1px",
        "border-left-style": "solid",
      },
      colors: {
        "border-top-color": color(42, 47, 44),
        "border-left-color": color(42, 47, 44),
      },
    });
    const mockup = record({
      exact: {
        ...tailwind.exact,
        "border-top-style": "none",
        "border-left-style": "dashed",
      },
      colors: {
        "border-top-color": color(244, 246, 245),
        "border-left-color": color(244, 246, 245),
      },
    });
    expect(withoutBorderOfNoWidth(tailwind).exact["border-top-style"]).toBe(
      "none",
    );
    expect(withoutBorderOfNoWidth(tailwind).colors["border-top-color"]).toBe(
      null,
    );
    expect(
      compareStyleRecord(
        withoutBorderOfNoWidth(mockup),
        withoutBorderOfNoWidth(tailwind),
      ),
    ).toEqual([
      "heading[0] <h1> border-left-color: rgba(244, 246, 245, 1) → rgba(42, 47, 44, 1)",
      "heading[0] <h1> border-left-style: dashed → solid",
    ]);
  });
});

describe("N3: captures and masks (05 §3)", () => {
  it("allows 0.5 % of a zone beyond a distance of 0.1", () => {
    expect(N3_SCREENSHOT_OPTIONS.maxDiffPixelRatio).toBe(0.005);
    expect(N3_SCREENSHOT_OPTIONS.threshold).toBe(0.1);
  });

  it("masks photos and logos, current dates, the account address, the environment band: nothing else", () => {
    expect([...MASK_KINDS].sort()).toEqual(
      [
        "account-email",
        "current-time",
        "environment-banner",
        "logo",
        "photo",
      ].sort(),
    );
    expect(isMaskKind("photo")).toBe(true);
    expect(isMaskKind("title")).toBe(false);
  });
});

/** The options of `#demo-state` of a mockup, read in its HTML. */
function selectorOptions(html: string): string[] {
  const select = /<select id="demo-state">([\s\S]*?)<\/select>/.exec(html);
  return [...(select?.[1] ?? "").matchAll(/<option value="([^"]*)"/g)].map(
    (option) => option[1] ?? "",
  );
}

describe(`the frozen mockups (${MOCKUP_COMMIT}, 05 §1)`, () => {
  const files = [
    ...readdirSync(MOCKUP_DIRECTORY).filter((file) =>
      /^proto-.*\.html$/.test(file),
    ),
    ...readdirSync(path.join(MOCKUP_DIRECTORY, "assets")).map(
      (file) => `assets/${file}`,
    ),
  ].sort();

  it("has the SHA-256 of 954e009 for every proto-*.html and every asset, nothing more", () => {
    expect(files).toEqual(Object.keys(MOCKUP_MANIFEST).sort());
    for (const file of files) {
      // The manifest is computed on the committed blobs (LF): fold the CRLF of a Windows checkout.
      const bytes = readFileSync(path.join(MOCKUP_DIRECTORY, file));
      const sha = createHash("sha256")
        .update(
          Buffer.from(
            bytes.toString("latin1").replaceAll("\r\n", "\n"),
            "latin1",
          ),
        )
        .digest("hex");
      expect(
        sha,
        `${file} changed after ${MOCKUP_COMMIT}: tell the founder`,
      ).toBe(MOCKUP_MANIFEST[file]);
    }
  });

  it("counts 23 mockups, 138 states of the selector, 9 of the anchor, 147 states, 588 captures", () => {
    expect(MOCKUPS.map((mockup) => mockup.file)).toEqual(
      files.filter((file) => file.startsWith("proto-")),
    );
    const sum = (count: (mockup: (typeof MOCKUPS)[number]) => number) =>
      MOCKUPS.reduce((total, mockup) => total + count(mockup), 0);
    expect(MOCKUPS).toHaveLength(SURVEY_COUNTS.mockups);
    expect(sum((mockup) => mockup.selectorStates.length)).toBe(
      SURVEY_COUNTS.selectorStates,
    );
    expect(sum((mockup) => mockup.anchorStates.length)).toBe(
      SURVEY_COUNTS.anchorStates,
    );
    expect(sum((mockup) => statesOf(mockup).length)).toBe(SURVEY_COUNTS.states);
    expect(surveyCaptures()).toHaveLength(SURVEY_COUNTS.captures);
  });

  it("lists the options of each mockup's selector, in order, and its default among them", () => {
    for (const mockup of MOCKUPS) {
      const html = readFileSync(
        path.join(MOCKUP_DIRECTORY, mockup.file),
        "utf8",
      );
      expect(mockup.selectorStates, mockup.file).toEqual(selectorOptions(html));
      const fallback = /<body[^>]*data-default="([^"]+)"/.exec(html)?.[1];
      expect(mockup.selectorStates, mockup.file).toContain(fallback);
      for (const state of mockup.anchorStates) {
        expect(mockup.selectorStates, `${mockup.file}#${state}`).not.toContain(
          state,
        );
      }
    }
  });

  it("names the 9 states of the anchor of 05 §1", () => {
    expect(
      MOCKUPS.flatMap((mockup) =>
        mockup.anchorStates.map((state) => `${mockup.file}#${state}`),
      ),
    ).toEqual([
      "proto-entree.html#email-createur",
      "proto-profil-marque.html#modif-1",
      "proto-profil-marque.html#modif-3",
      "proto-profil.html#etape-2",
      "proto-profil.html#etape-4",
      "proto-profil.html#modif-1",
      "proto-profil.html#modif-2",
      "proto-profil.html#modif-4",
      "proto-profil.html#modif-5",
    ]);
  });

  it("samples one state per family, a state of its mockup", () => {
    for (const [family, sample] of Object.entries(FAMILY_SAMPLES)) {
      const mockup = mockupOf(sample.file);
      expect(mockup.family, family).toBe(family);
      expect(statesOf(mockup), family).toContain(sample.state);
    }
    expect(() => mockupOf("ecran-1-accueils.html")).toThrow(/not a mockup/);
  });
});

describe("RU-19: the backoffice from 768 to 1 023 px is out of N1 to N3", () => {
  it("has no window of the backoffice in that band", () => {
    for (const space of ["backoffice", "small-window"] as const) {
      for (const window of VISUAL_WINDOWS[space]) {
        expect(
          visualWindowRefusal(space, window),
          `${space} ${window.width}`,
        ).toBeNull();
      }
    }
    expect(VISUAL_WINDOWS.member.map((window) => window.width)).toEqual([
      375, 768, 1280, 1440,
    ]);
  });

  it("refuses 768 and 1 023 to the backoffice, allows 767, 1 024 and 768 to the members", () => {
    expect(
      visualWindowRefusal("backoffice", { width: 768, height: 1024 }),
    ).toMatch(/^RU-19/);
    expect(
      visualWindowRefusal("backoffice", { width: 1023, height: 768 }),
    ).toMatch(/^RU-19/);
    expect(
      visualWindowRefusal("small-window", { width: 900, height: 600 }),
    ).toMatch(/^RU-19/);
    expect(
      visualWindowRefusal("backoffice", { width: 767, height: 900 }),
    ).toBeNull();
    expect(
      visualWindowRefusal("backoffice", { width: 1024, height: 768 }),
    ).toBeNull();
    expect(
      visualWindowRefusal("member", { width: 768, height: 1024 }),
    ).toBeNull();
  });
});

describe("the couples mockup ↔ application", () => {
  const couple = (overrides: Partial<VisualCouple> = {}): VisualCouple => ({
    id: "E04:matin",
    mockup: { file: "proto-bo-accueil.html", state: "matin" },
    app: {
      front: "backoffice",
      path: "/accueil",
      load: { space: "backoffice", options: {} },
      ready: "main h1",
    },
    structure: { mockup: "body", app: "body" },
    parts: [],
    matrix: [{ name: "E04-S01", mockup: "main h1", app: "main h1" }],
    zones: [{ name: "main", mockup: "main", app: "main" }],
    masks: [],
    variables: [],
    ...overrides,
  });

  it("are valid: the four states of the member shell from RUB line 11, each a couple that can be compared", () => {
    expect(VISUAL_COUPLES.map((each) => each.id)).toEqual([
      "E01.0:marque-neuve",
      "E01.0:marque",
      "E01.0:createur-neuf",
      "E01.0:createur",
    ]);
    expect(new Set(VISUAL_COUPLES.map((each) => each.mockup.file))).toEqual(
      new Set(["proto-accueils.html"]),
    );
    expect(coupleProblems(VISUAL_COUPLES)).toEqual([]);
    expect(coupleProblems([couple()])).toEqual([]);
    for (const each of VISUAL_COUPLES) {
      // S02 to S16 but S08 and S09 (proto-compte's), the zones of A §6, the address masked only.
      expect(each.matrix.map((line) => line.name)).toEqual(
        [2, 3, 4, 5, 6, 7, 10, 11, 12, 13, 14, 15, 16].map(
          (line) => `E01.0-S${String(line).padStart(2, "0")}`,
        ),
      );
      expect(each.parts.map((part) => part.name)).toEqual([
        "header",
        "navigation",
        "state",
        "foot",
      ]);
      expect(each.zones.map((zone) => zone.name)).toEqual([
        "column",
        "header",
        "navigation",
      ]);
      expect(each.masks.map((mask) => mask.kind)).toEqual(["account-email"]);
      expect(each.app.front).toBe("web");
    }
  });

  it("hold for each couple the deviations submitted to F1, each a line of N1 to N3 in a window of its space (05 §3)", () => {
    expect(Object.keys(SUBMITTED_DEVIATIONS).sort()).toEqual(
      VISUAL_COUPLES.map((each) => each.id).sort(),
    );
    for (const [id, deviations] of Object.entries(SUBMITTED_DEVIATIONS)) {
      const ids = deviations.map((deviation) => deviation.id);
      expect(new Set(ids).size, id).toBe(ids.length);
      for (const deviation of deviations) {
        // Never written as granted without the founder's consent (06b §7): F1 decides.
        expect(deviation.status, `${id} ${deviation.id}`).toBe("submitted");
        expect(deviation.why.length, deviation.id).toBeGreaterThan(20);
        for (const width of deviation.widths) {
          expect([375, 768, 1280, 1440], deviation.id).toContain(width);
        }
        for (const line of deviation.lines) {
          expect(line, deviation.id).toMatch(/^N[123] /);
        }
      }
      expect(
        expectedDifferences(deviations, 1280).every((line) =>
          line.startsWith("1280: "),
        ),
      ).toBe(true);
    }
  });

  it("refuses a line E..-S.. as identifier, a state other than the mockup's, a line of another screen", () => {
    expect(coupleProblems([couple({ id: "E01.0-S02" as never })])).toEqual([
      "E01.0-S02: not an identifier E..:<state>",
    ]);
    expect(coupleProblems([couple({ id: "E04:calme" })])).toEqual([
      "E04:calme: the state of the identifier is not matin",
    ]);
    expect(
      coupleProblems([
        couple({
          matrix: [{ name: "E05-S01", mockup: "main h1", app: "main h1" }],
        }),
      ]),
    ).toEqual(["E04:matin: E05-S01 is not a line of the matrix of E04"]);
    expect(
      coupleProblems([
        couple({
          matrix: [{ name: "E04.1-S01", mockup: "main h1", app: "main h1" }],
        }),
      ]),
    ).toEqual(["E04:matin: E04.1-S01 is not a line of the matrix of E04"]);
  });

  it("refuses a backoffice couple at 900 px, a foreign mask, an unknown state or mockup", () => {
    expect(
      coupleProblems([couple({ windows: [{ width: 900, height: 800 }] })]),
    ).toEqual([expect.stringMatching(/^E04:matin: RU-19/)]);
    expect(
      coupleProblems([
        couple({
          masks: [{ kind: "title" as never, mockup: "h1", app: "h1" }],
        }),
      ]),
    ).toEqual(['E04:matin: "title" is not a mask of 05 §3']);
    expect(
      coupleProblems([
        couple({
          id: "E04:nuit",
          mockup: { file: "proto-bo-accueil.html", state: "nuit" },
        }),
      ]),
    ).toEqual(["E04:nuit: nuit is not a state of proto-bo-accueil.html"]);
    expect(
      coupleProblems([
        couple({ id: "E04:a", mockup: { file: "proto-x.html", state: "a" } }),
      ]),
    ).toEqual(["E04:a: proto-x.html is not a mockup"]);
  });

  it("refuses an identifier that is not E..:<state>, twice the same, an empty matrix or no zone", () => {
    expect(coupleProblems([couple({ id: "E4:matin" })])).toEqual([
      "E4:matin: not an identifier E..:<state>",
    ]);
    expect(coupleProblems([couple(), couple()])).toEqual([
      "E04:matin: declared twice",
    ]);
    expect(coupleProblems([couple({ matrix: [], zones: [] })])).toEqual([
      "E04:matin: no line of the N2 matrix",
      "E04:matin: no N3 zone",
    ]);
  });
});

describe("the `visual` project exists only under E2E_VISUAL (modele-archi.md §5)", () => {
  const initial = process.env.E2E_VISUAL;

  afterEach(() => {
    if (initial === undefined) delete process.env.E2E_VISUAL;
    else process.env.E2E_VISUAL = initial;
    vi.resetModules();
  });

  async function config(value: string | undefined) {
    if (value === undefined) delete process.env.E2E_VISUAL;
    else process.env.E2E_VISUAL = value;
    vi.resetModules();
    return (await import("../playwright.config")).default;
  }

  it("unset: chromium ignores e2e/visual/, no project `visual`, no reference template", async () => {
    const unset = await config(undefined);
    const names = (unset.projects ?? []).map((project) => project.name);
    expect(names).toEqual(["chromium", "charter-headings"]);
    const chromium = unset.projects?.[0];
    const ignored = [chromium?.testIgnore ?? []].flat() as RegExp[];
    expect(
      ignored.some((pattern) => pattern.test("e2e/visual/survey.spec.ts")),
    ).toBe(true);
    expect(unset.snapshotPathTemplate).toBeUndefined();
    expect(unset.globalSetup).toBe("./e2e/global-setup.ts");
  });

  it("mockup: the project alone, fr-FR and reduced motion, no server, no global setup, never -u", async () => {
    const mockup = await config("mockup");
    expect((mockup.projects ?? []).map((project) => project.name)).toEqual([
      "visual",
    ]);
    const visual = mockup.projects?.[0];
    expect(visual?.use?.locale).toBe("fr-FR");
    expect(visual?.use?.reducedMotion).toBe("reduce");
    const match = visual?.testMatch as RegExp;
    expect(match.test("e2e/visual/survey.spec.ts")).toBe(true);
    expect(match.test("e2e/visual/mockup-self.spec.ts")).toBe(true);
    expect(match.test("e2e/visual/app.spec.ts")).toBe(false);
    expect(match.test("e2e/backoffice.spec.ts")).toBe(false);
    expect(mockup.webServer).toEqual([]);
    expect(mockup.globalSetup).toBeUndefined();
    expect(mockup.updateSnapshots).toBe("none");
    expect(mockup.snapshotPathTemplate).toMatch(
      /^\{testDir\}\/\.\.\/test-results\//,
    );
  });

  it("app: the servers of the ordinary mode; any other value is refused", async () => {
    const app = await config("app");
    expect((app.projects ?? []).map((project) => project.name)).toEqual([
      "visual",
    ]);
    expect([app.webServer].flat()).toHaveLength(5);
    const match = app.projects?.[0]?.testMatch as RegExp;
    expect(match.test("e2e/visual/app.spec.ts")).toBe(true);
    expect(match.test("e2e/visual/survey.spec.ts")).toBe(false);
    expect(match.test("e2e/visual/mockup-self.spec.ts")).toBe(false);
    await expect(config("all")).rejects.toThrow(
      /E2E_VISUAL is "mockup" or "app"/,
    );
  });
});

/** The image files under a directory, relative to it. */
function imagesUnder(directory: string): string[] {
  return readdirSync(directory, { recursive: true, withFileTypes: true })
    .filter(
      (entry) =>
        entry.isFile() && /\.(png|jpe?g|webp|gif|avif|bmp)$/i.test(entry.name),
    )
    .map((entry) =>
      path.relative(directory, path.join(entry.parentPath, entry.name)),
    );
}

describe("no image under apps/web/e2e (05 §3: a reference is never committed)", () => {
  it("finds none", () => {
    expect(imagesUnder(path.join(WEB_ROOT, "e2e"))).toEqual([]);
  });

  it("would find one (negative case)", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "visual-guard-"));
    try {
      mkdirSync(path.join(directory, "visual", "survey.spec.ts-snapshots"), {
        recursive: true,
      });
      writeFileSync(
        path.join(directory, "visual", "survey.spec.ts-snapshots", "main.png"),
        "",
      );
      expect(imagesUnder(directory)).toEqual([
        path.join("visual", "survey.spec.ts-snapshots", "main.png"),
      ]);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});

// RUAT-4 (jalons/rub/modele-archi.md §6): the floors of the visual specs are read by a test, not only
// by a script run by hand after a local run. A floor names a spec that exists, is a positive integer,
// and every spec of e2e/visual has its floor (the mockups' or the `app` project's).
function floorProblems(
  floors: Readonly<Record<string, number>>,
  specs: readonly string[],
  mustExist: boolean,
): string[] {
  const problems: string[] = [];
  for (const [file, floor] of Object.entries(floors)) {
    if (!Number.isInteger(floor) || floor <= 0) {
      problems.push(`${file}: the floor ${floor} is not a positive integer`);
    }
    if (mustExist && !specs.includes(file)) {
      problems.push(`${file}: a floor without a spec`);
    }
  }
  return problems;
}

describe("the floors of the visual specs (RUAT-4)", () => {
  const specs = readdirSync(path.join(WEB_ROOT, "e2e", "visual"))
    .filter((name) => name.endsWith(".spec.ts"))
    .map((name) => `e2e/visual/${name}`)
    .sort();

  it("name existing specs, with a positive floor, every spec of e2e/visual with its floor", () => {
    expect(floorProblems(MOCKUP_CASE_FLOORS, specs, true)).toEqual([]);
    expect(floorProblems(APP_CASE_FLOORS, specs, true)).toEqual([]);
    expect(
      [
        ...Object.keys(MOCKUP_CASE_FLOORS),
        ...Object.keys(APP_CASE_FLOORS),
      ].sort(),
    ).toEqual(specs);
  });

  it("hold the app floor of the mockup tool in a module of its own: a case per couple, and two", () => {
    // app.spec.ts is written by RUB line 11: its file is required from then on.
    expect(Object.keys(APP_CASE_FLOORS)).toEqual(["e2e/visual/app.spec.ts"]);
    expect(specs).toContain("e2e/visual/app.spec.ts");
    expect(APP_CASE_FLOORS["e2e/visual/app.spec.ts"]).toBeGreaterThanOrEqual(
      Math.max(4, VISUAL_COUPLES.length + 2),
    );
  });

  it("would refuse a floor without a spec and a floor that is not positive (negative case)", () => {
    expect(
      floorProblems(
        { "e2e/visual/gone.spec.ts": 3, "e2e/visual/survey.spec.ts": 0 },
        specs,
        true,
      ),
    ).toEqual([
      "e2e/visual/gone.spec.ts: a floor without a spec",
      "e2e/visual/survey.spec.ts: the floor 0 is not a positive integer",
    ]);
    expect(
      floorProblems({ "e2e/visual/survey.spec.ts": 1.5 }, specs, true),
    ).toEqual([
      "e2e/visual/survey.spec.ts: the floor 1.5 is not a positive integer",
    ]);
  });
});
