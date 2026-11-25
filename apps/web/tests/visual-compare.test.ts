// RUA-03 (jalons/rua/03.md, modele-archi.md §5; 22-refonte-ux-ui/05 §1 to §3): the mockup comparison
// tool without a browser. The comparators of N1 and N2 and their tolerances, the options and masks
// of N3, the manifest of the frozen mockups (954e009) and the 147 states of the survey, RU-19 refused
// by the data, the couples (empty in RUA), the `visual` project defined only under E2E_VISUAL, and no
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
    id: "E04-S01",
    mockup: { file: "proto-bo-accueil.html", state: "matin" },
    app: { front: "backoffice", path: "/accueil" },
    matrix: [{ name: "title", mockup: "main h1", app: "main h1" }],
    zones: [{ name: "main", mockup: "main", app: "main" }],
    masks: [],
    variables: [],
    ...overrides,
  });

  it("is empty in RUA: no screen is compared before RUB", () => {
    expect(VISUAL_COUPLES).toEqual([]);
    expect(coupleProblems(VISUAL_COUPLES)).toEqual([]);
    expect(coupleProblems([couple()])).toEqual([]);
  });

  it("refuses a backoffice couple at 900 px, a foreign mask, an unknown state or mockup", () => {
    expect(
      coupleProblems([couple({ windows: [{ width: 900, height: 800 }] })]),
    ).toEqual([expect.stringMatching(/^E04-S01: RU-19/)]);
    expect(
      coupleProblems([
        couple({
          masks: [{ kind: "title" as never, mockup: "h1", app: "h1" }],
        }),
      ]),
    ).toEqual(['E04-S01: "title" is not a mask of 05 §3']);
    expect(
      coupleProblems([
        couple({ mockup: { file: "proto-bo-accueil.html", state: "nuit" } }),
      ]),
    ).toEqual(["E04-S01: nuit is not a state of proto-bo-accueil.html"]);
    expect(
      coupleProblems([
        couple({ mockup: { file: "proto-x.html", state: "a" } }),
      ]),
    ).toEqual(["E04-S01: proto-x.html is not a mockup"]);
  });

  it("refuses an identifier that is not E..-S.., twice the same, an empty matrix or no zone", () => {
    expect(coupleProblems([couple({ id: "E4-S1" })])).toEqual([
      "E4-S1: not an identifier E..-S..",
    ]);
    expect(coupleProblems([couple(), couple()])).toEqual([
      "E04-S01: declared twice",
    ]);
    expect(coupleProblems([couple({ matrix: [], zones: [] })])).toEqual([
      "E04-S01: no line of the N2 matrix",
      "E04-S01: no N3 zone",
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
    expect([app.webServer].flat()).toHaveLength(4);
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

  it("name existing specs, with a positive floor", () => {
    expect(floorProblems(MOCKUP_CASE_FLOORS, specs, true)).toEqual([]);
    expect(Object.keys(MOCKUP_CASE_FLOORS).sort()).toEqual(
      specs.filter((file) => !(file in APP_CASE_FLOORS)),
    );
  });

  it("hold the app floor of the mockup tool in a module of its own: 4 cases at least", () => {
    // app.spec.ts is written by RUB line 11: its file is required from then on.
    expect(Object.keys(APP_CASE_FLOORS)).toEqual(["e2e/visual/app.spec.ts"]);
    expect(floorProblems(APP_CASE_FLOORS, specs, false)).toEqual([]);
    expect(APP_CASE_FLOORS["e2e/visual/app.spec.ts"]).toBeGreaterThanOrEqual(4);
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
