// Self-checks of the guards of the RK milestone (D75; docs/mvp/18-plan-de-test-mvp.md §5.1 and §12.6,
// TK7.1 to TK7.5; 02 §21.3 point 3): each new guard sees its negative case (R4), on a minified
// stylesheet and on Windows line breaks too. The guards applied to the real sources live in the
// guard tests of each front, the ones applied to the build in the specs of RK-3 and RK-5.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import {
  classLiteralsOf,
  compiledClasses,
  findClassesWithoutRule,
  findDocumentSmoothing,
  findFluidKeoTypography,
  findInscribedKeoTokens,
  findKeoTrapViolations,
  findPhotoEffectUse,
  findTokenPairFailures,
  findTokenUseOutside,
  findUnreadKeoTokens,
  fluidTypographyClasses,
  selectorClasses,
  utilityOf,
  withMixOver,
  type ColorMixAllowance,
} from "../src/guards.ts";
import {
  CONTRAST_MATRIX,
  KEO_COLOR_MIX,
  PHOTO_EFFECT_READERS,
  PHOTO_SCRIM,
  PHOTO_SCRIM_PAIRS,
  PHOTO_SCRIM_STRONG,
  PHOTO_WORST,
} from "../src/charter-data.ts";

const TEMP_ROOT = mkdtempSync(path.join(tmpdir(), "influx-rendering-guards-"));

afterAll(() => {
  rmSync(TEMP_ROOT, { recursive: true, force: true });
});

/** A tokens.css shaped like the real one, its KEO block made of the given declarations. */
function tokensWith(...keo: string[]): string {
  return [
    "@theme static {",
    "  --*: initial;",
    "  --color-brand-primary: #22c55e;",
    "  --color-surface-card: #111111;",
    "  --radius-card: 0.75rem;",
    "  --shadow-action-glow: none;",
    "  --breakpoint-md: 768px;",
    "  --container-narrow: 40rem;",
    "  --background-image-header-glow: none;",
    "  --text-md: 1rem;",
    "  --text-md--line-height: 1.5;",
    "  --text-lead: clamp(1.125rem, 1.081rem + 0.1878vw, 1.25rem);",
    "  --text-heading-3: clamp(1.25rem, 1.162rem + 0.3756vw, 1.5rem);",
    "  --text-title: var(--text-md);",
    "  --tracking-heading: -0.01em;",
    "}",
    ":root {",
    "  --effect-action-glow: 0 0 transparent;",
    "  --effect-action-glow-hover: 0 0 transparent;",
    "}",
    "@layer base {",
    '  [data-theme="keo"] {',
    ...keo.map((declaration) => `    ${declaration}`),
    "  }",
    "}",
  ].join("\n");
}

/** The same sheet on one line, and with Windows line breaks. */
function variants(css: string): Record<string, string> {
  return {
    "as written": css,
    minified: css.replace(/\s*\n\s*/g, ""),
    CRLF: css.replace(/\n/g, "\r\n"),
  };
}

const ALLOWANCES: readonly ColorMixAllowance[] = [
  { name: "--effect-action-glow" },
  { name: "--background-image-header-glow", maxPercent: 15 },
];

const GLOW_25 =
  "color-mix(in srgb, var(--color-brand-primary) 25%, transparent)";

describe("TK7.1 G3i (a): no KEO token in a namespace that Tailwind inscribes, color-mix in the RK-A tokens only", () => {
  it("accepts the KEO block of RK-A: --effect-* glows and a header glow at 15 %", () => {
    const css = tokensWith(
      "--color-brand-primary: #1dd68a;",
      "--radius-card: 1rem;",
      `--effect-action-glow: 0 0.25rem 0.875rem ${GLOW_25};`,
      "--background-image-header-glow: radial-gradient(ellipse 50% 16rem at 50% 0%, color-mix(in srgb, var(--color-brand-primary) 15%, transparent), transparent);",
    );
    for (const [shape, sheet] of Object.entries(variants(css))) {
      expect(findKeoTrapViolations(sheet, ALLOWANCES), shape).toEqual([]);
    }
  });

  it("detects a token of the --shadow-, --breakpoint- and --container- namespaces redefined under KEO (constat C1)", () => {
    const css = tokensWith(
      "--shadow-action-glow: 0 0.5rem 1.5rem -0.5rem var(--color-brand-primary);",
      "--breakpoint-md: 48rem;",
      "--container-narrow: 42rem;",
    );
    for (const [shape, sheet] of Object.entries(variants(css))) {
      expect(findKeoTrapViolations(sheet, ALLOWANCES), shape).toEqual([
        "--shadow-action-glow: redefined in the KEO block, in the --shadow-* namespace that Tailwind inscribes",
        "--breakpoint-md: redefined in the KEO block, in the --breakpoint-* namespace that Tailwind inscribes",
        "--container-narrow: redefined in the KEO block, in the --container-* namespace that Tailwind inscribes",
      ]);
    }
  });

  it("detects @theme inline, never in a comment", () => {
    const commented = `/* never @theme inline here */\n${tokensWith()}`;
    expect(findKeoTrapViolations(commented, ALLOWANCES)).toEqual([]);
    const inline = tokensWith().replace("@theme static {", "@theme inline {");
    expect(findKeoTrapViolations(inline, ALLOWANCES)).toEqual([
      "@theme inline: Tailwind would inscribe every value, KEO would be read nowhere",
    ]);
  });

  it("detects a color-mix outside the RK-A tokens, outside the KEO block, of another form or over its ceiling", () => {
    const css = [
      tokensWith(
        `--color-surface-card: ${GLOW_25};`,
        "--effect-action-glow: 0 0 1rem color-mix(in oklab, var(--color-brand-primary) 25%, transparent);",
        "--background-image-header-glow: radial-gradient(color-mix(in srgb, var(--color-brand-primary) 18%, transparent), transparent);",
      ),
      `:root { --effect-action-glow-hover: 0 0 1rem ${GLOW_25}; }`,
    ].join("\n");
    for (const [shape, sheet] of Object.entries(variants(css))) {
      expect(findKeoTrapViolations(sheet, ALLOWANCES), shape).toEqual([
        `--color-surface-card: "${GLOW_25}" outside the tokens of RK-A`,
        '--effect-action-glow: "color-mix(in oklab, var(--color-brand-primary) 25%, transparent)" is not the brand green mixed with transparency',
        "--background-image-header-glow: 18% over its ceiling of 15%",
        `--effect-action-glow-hover: "${GLOW_25}" outside the tokens of RK-A (not in the KEO block)`,
      ]);
    }
  });

  it("holds the three tokens of RK-A, the header glow at 15 % at most, and the four of RU-04, exact base and share (charter-data)", () => {
    expect(KEO_COLOR_MIX).toEqual([
      { name: "--effect-action-glow" },
      { name: "--effect-action-glow-hover" },
      { name: "--background-image-header-glow", maxPercent: 15 },
      {
        name: "--effect-photo-scrim-strong",
        base: "var(--color-surface-page)",
        percent: 82,
      },
      {
        name: "--effect-photo-scrim",
        base: "var(--color-surface-page)",
        percent: 75,
      },
      {
        name: "--effect-photo-scrim-soft",
        base: "var(--color-surface-page)",
        percent: 45,
      },
      { name: "--effect-photo-shadow", base: "#000000", percent: 50 },
    ]);
  });
});

const PHOTO_ALLOWANCES: readonly ColorMixAllowance[] = [
  ...ALLOWANCES,
  {
    name: "--effect-photo-scrim",
    base: "var(--color-surface-page)",
    percent: 75,
  },
  {
    name: "--effect-photo-scrim-soft",
    base: "var(--color-surface-page)",
    percent: 45,
  },
  { name: "--effect-photo-shadow", base: "#000000", percent: 50 },
];

const SCRIM_75 =
  "color-mix(in srgb, var(--color-surface-page) 75%, transparent)";
const SHADOW_50 =
  "drop-shadow(0 1px 2px color-mix(in srgb, #000000 50%, transparent))";

describe("TK7.1 G3i (a) extended (RU-04, D88): the effects on a photo, exact base and share, in the KEO block alone", () => {
  it("accepts the scrim and the shadow in the form of the table, whatever the layout of the sheet", () => {
    const css = tokensWith(
      "--color-surface-page: #0a0b0a;",
      `--effect-photo-scrim: ${SCRIM_75};`,
      `--effect-photo-shadow: ${SHADOW_50};`,
    );
    for (const [shape, sheet] of Object.entries(variants(css))) {
      expect(findKeoTrapViolations(sheet, PHOTO_ALLOWANCES), shape).toEqual([]);
    }
    // A mix split over several lines is the same value.
    const split = tokensWith(
      "--effect-photo-scrim: color-mix(\n in srgb,\n var(--color-surface-page) 75%,\n transparent\n );",
    );
    expect(findKeoTrapViolations(split, PHOTO_ALLOWANCES)).toEqual([]);
  });

  it("detects a scrim in green, a shadow or a scrim at another share, the page surface in the halo of the button, a scrim valued outside the KEO block", () => {
    const css = [
      tokensWith(
        "--effect-photo-scrim: color-mix(in srgb, var(--color-brand-primary) 75%, transparent);",
        "--effect-photo-shadow: drop-shadow(0 1px 2px color-mix(in srgb, #000000 40%, transparent));",
        "--effect-photo-scrim-soft: color-mix(in srgb, var(--color-surface-page) 80%, transparent);",
        "--effect-action-glow: 0 0 1rem color-mix(in srgb, var(--color-surface-page) 25%, transparent);",
      ),
      `:root { --effect-photo-scrim-strong: ${SCRIM_75}; }`,
    ].join("\n");
    for (const [shape, sheet] of Object.entries(variants(css))) {
      expect(findKeoTrapViolations(sheet, PHOTO_ALLOWANCES), shape).toEqual([
        '--effect-photo-scrim: "color-mix(in srgb, var(--color-brand-primary) 75%, transparent)" is not the page surface mixed with transparency',
        "--effect-photo-shadow: 40% instead of the 50% allowed",
        "--effect-photo-scrim-soft: 80% instead of the 45% allowed",
        '--effect-action-glow: "color-mix(in srgb, var(--color-surface-page) 25%, transparent)" is not the brand green mixed with transparency',
        `--effect-photo-scrim-strong: "${SCRIM_75}" outside the tokens of RK-A (not in the KEO block)`,
      ]);
    }
  });

  it("refuses a rgba(, hsla( or #rrggbbaa in any --effect-*, in the KEO block or not, and a --color-* given an allowance", () => {
    const css = [
      tokensWith(
        "--effect-photo-shadow: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.5));",
        "--effect-photo-scrim: hsla(0, 0%, 4%, 0.75);",
      ),
      ":root { --effect-media-hover: #0a0b0abf; --effect-other: brightness(0.85); }",
    ].join("\n");
    for (const [shape, sheet] of Object.entries(variants(css))) {
      expect(findKeoTrapViolations(sheet, PHOTO_ALLOWANCES), shape).toEqual([
        '--effect-photo-shadow: "drop-shadow(0 1px 2px rgba(0, 0, 0, 0.5))" holds an alpha color, a color-mix over transparency replaces it',
        '--effect-photo-scrim: "hsla(0, 0%, 4%, 0.75)" holds an alpha color, a color-mix over transparency replaces it',
        '--effect-media-hover: "#0a0b0abf" holds an alpha color, a color-mix over transparency replaces it',
      ]);
    }
    expect(
      findKeoTrapViolations(tokensWith(), [
        { name: "--color-surface-card", percent: 50 },
      ]),
    ).toEqual(["--color-surface-card: a --color-* never holds a color-mix"]);
  });
});

describe("TK7.1 G3d and G8 (RU-04, D88): a scrim read over the lightest photo, the text held on it, the four tokens confined", () => {
  const scrims = (strong: number, scrim: number): Map<string, string> =>
    new Map([
      ["--color-text-primary", "#f4f6f5"],
      ["--color-surface-page", "#0a0b0a"],
      [
        "--effect-photo-scrim-strong",
        `color-mix(in srgb, #0a0b0a ${strong}%, transparent)`,
      ],
      [
        "--effect-photo-scrim",
        `color-mix(in srgb, #0a0b0a ${scrim}%, transparent)`,
      ],
    ]);
  const derived = (tokens: ReadonlyMap<string, string>) =>
    withMixOver(
      withMixOver(
        tokens,
        "--effect-photo-scrim-strong",
        PHOTO_WORST,
        PHOTO_SCRIM_STRONG,
      ),
      "--effect-photo-scrim",
      PHOTO_WORST,
      PHOTO_SCRIM,
    );

  it("lays the mix over a hex or over a token, and throws on a token without a mix or a ground it cannot read", () => {
    const over = (ground: string) =>
      withMixOver(
        scrims(82, 75),
        "--effect-photo-scrim-strong",
        ground,
        "--derived",
      ).get("--derived");
    expect(over(PHOTO_WORST)).toBe("#363736");
    expect(over("--color-surface-page")).toBe("#0a0b0a");
    expect(() =>
      withMixOver(scrims(82, 75), "--color-text-primary", PHOTO_WORST, "--x"),
    ).toThrow("--color-text-primary: no color-mix over transparency");
    expect(() =>
      withMixOver(scrims(82, 75), "--effect-photo-scrim", "--missing", "--x"),
    ).toThrow("--missing: not a 6-digit hex color nor a token holding one");
  });

  it("holds the primary text on the scrims of 82 and 75 % over white at 4.5:1, and fails on a scrim read at 45 %", () => {
    expect(
      findTokenPairFailures(derived(scrims(82, 75)), PHOTO_SCRIM_PAIRS),
    ).toEqual([]);
    expect(
      findTokenPairFailures(derived(scrims(82, 45)), PHOTO_SCRIM_PAIRS),
    ).toHaveLength(1);
  });

  // Changed in RUB-09a (invariant 8, TD1): the list, empty in RUA, is now one per front, the classes of the photo
  // card for the members and nothing for the backoffice; the cases of RUA stand, and a module of one front's list
  // read in the other front, or listed and absent, is reported (negative cases).
  it("confines the four tokens to the list of PHOTO_EFFECT_READERS of each front: a read elsewhere is reported, a comment is not, a module of the other front's list is not allowed (G8)", () => {
    expect(PHOTO_EFFECT_READERS).toEqual({
      web: ["src/components/member/ui/photo-card-classes.ts"],
      backoffice: [],
    });
    const memberFront = path.join(TEMP_ROOT, "photo-member-front");
    const memberReader = PHOTO_EFFECT_READERS.web[0];
    const memberFile = path.join(memberFront, memberReader);
    mkdirSync(path.dirname(memberFile), { recursive: true });
    writeFileSync(
      memberFile,
      'export const HEART = "fill-(--effect-photo-scrim-soft)";\n',
    );
    expect(findPhotoEffectUse(memberFront, PHOTO_EFFECT_READERS.web)).toEqual(
      [],
    );
    expect(
      findPhotoEffectUse(memberFront, PHOTO_EFFECT_READERS.backoffice),
    ).toEqual([
      `${memberReader}:1: export const HEART = "fill-(--effect-photo-scrim-soft)";`,
    ]);
    expect(
      findPhotoEffectUse(
        path.join(TEMP_ROOT, "photo-empty-front"),
        PHOTO_EFFECT_READERS.web,
      ),
    ).toEqual([
      `${memberReader}: listed as allowed to use effect-photo-scrim-strong, does not exist`,
      `${memberReader}: listed as allowed to use effect-photo-scrim, does not exist`,
      `${memberReader}: listed as allowed to use effect-photo-scrim-soft, does not exist`,
      `${memberReader}: listed as allowed to use effect-photo-shadow, does not exist`,
    ]);
    const front = path.join(TEMP_ROOT, "photo-front");
    const write = (relative: string, content: string) => {
      const file = path.join(front, relative);
      mkdirSync(path.dirname(file), { recursive: true });
      writeFileSync(file, content);
    };
    const reader = "src/components/member/ui/PhotoBadge.tsx";
    write(reader, 'export const BADGE = "bg-(--effect-photo-scrim-strong)";\n');
    write(
      "src/components/member/ui/Card.tsx",
      [
        "// never bg-(--effect-photo-scrim) on a card (RU-04)",
        'export const CARD = "bg-surface-card";',
        'export const WRONG = "filter-(--effect-photo-shadow)";',
        'export const SOFT = "bg-(--effect-photo-scrim-soft)";',
      ].join("\n"),
    );
    expect(findPhotoEffectUse(front, [reader])).toEqual([
      'src/components/member/ui/Card.tsx:4: export const SOFT = "bg-(--effect-photo-scrim-soft)";',
      'src/components/member/ui/Card.tsx:3: export const WRONG = "filter-(--effect-photo-shadow)";',
    ]);
    expect(findPhotoEffectUse(front, [])).toHaveLength(3);
  });
});

describe("TK7.1 G3i (b): every utility of a KEO token reads var() in the build", () => {
  const tokens = tokensWith(
    "--color-surface-card: #121413;",
    "--radius-card: 1rem;",
    "--shadow-action-glow: 0 0.5rem 1.5rem -0.5rem var(--color-brand-primary);",
  );
  const sound = [
    ":root,:host{--color-surface-card:#111;--radius-card:.75rem;--shadow-action-glow:none}",
    "@layer utilities{",
    ".rounded-card{border-radius:var(--radius-card)}",
    ".bg-surface-card{background-color:var(--color-surface-card)}",
    ".shadow-\\(--effect-action-glow\\){--tw-shadow:var(--effect-action-glow);box-shadow:var(--tw-inset-shadow),var(--tw-shadow)}",
    ".text-md{font-size:var(--text-md)}",
    "}",
  ].join("\n");

  it("accepts utilities that read their token, an arbitrary var() and a utility of another namespace", () => {
    expect(findInscribedKeoTokens(sound, tokens)).toEqual([]);
  });

  it("detects the rule of constat C1, .shadow-action-glow{--tw-shadow:none}, minified and with CRLF", () => {
    const faulty = `${sound}\n@layer utilities{\n.shadow-action-glow{--tw-shadow:none;box-shadow:var(--tw-inset-shadow),var(--tw-shadow)}\n}`;
    for (const [shape, sheet] of Object.entries(variants(faulty))) {
      expect(findInscribedKeoTokens(sheet, tokens), shape).toEqual([
        ".shadow-action-glow: a utility of --shadow-action-glow that does not read var(--shadow-action-glow) {--tw-shadow:none;box-shadow:var(--tw-inset-shadow),var(--tw-shadow)}",
      ]);
    }
  });

  it("detects an inscribed value behind a variant written nested, as Tailwind writes it", () => {
    const nested =
      ".hover\\:rounded-card{&:hover{@media (hover:hover){border-radius:.75rem}}}";
    expect(findInscribedKeoTokens(nested, tokens)).toEqual([
      ".hover\\:rounded-card:hover: a utility of --radius-card that does not read var(--radius-card) {border-radius:.75rem}",
    ]);
  });

  it("detects a KEO token that no rule reads, unless justified; a stale justification too", () => {
    expect(findUnreadKeoTokens(sound, tokens)).toEqual([
      "--shadow-action-glow: redefined in the KEO block, read through var() by no rule of the build",
    ]);
    expect(
      findUnreadKeoTokens(sound, tokens, ["--shadow-action-glow"]),
    ).toEqual([]);
    expect(
      findUnreadKeoTokens(sound, tokens, [
        "--shadow-action-glow",
        "--radius-card",
        "--color-unknown",
      ]),
    ).toEqual([
      "--radius-card: stale justification, read by the build",
      "--color-unknown: stale justification, not redefined in the KEO block",
    ]);
  });

  it("reads class names unescaped, and a utility without its variants", () => {
    expect(
      selectorClasses(
        ".motion-safe\\:not-aria-disabled\\:hover\\:scale-\\(--scale-hover\\):hover .\\31 0",
      ),
    ).toEqual([
      "motion-safe:not-aria-disabled:hover:scale-(--scale-hover)",
      "10",
    ]);
    expect(utilityOf("motion-safe:hover:scale-(--scale-hover)")).toBe(
      "scale-(--scale-hover)",
    );
    expect(utilityOf("bg-[url(a:b)]")).toBe("bg-[url(a:b)]");
    expect(utilityOf("lg:shadow-action-glow!")).toBe("shadow-action-glow");
  });
});

describe("TK7.2: every class literal of a module of classes has a compiled rule", () => {
  const built = [
    "@layer utilities{",
    ".font-display{font-family:var(--font-display)}",
    ".tracking-overline{letter-spacing:var(--tracking-overline)}",
    ".motion-safe\\:hover\\:scale-\\(--scale-hover\\){@media (prefers-reduced-motion:no-preference){&:hover{scale:var(--scale-hover)}}}",
    ".border-\\(length\\:--border-width-thin\\){border-width:var(--border-width-thin)}",
    ".group-hover\\:underline{&:is(:where(.group):hover *){text-decoration-line:underline}}",
    "}",
  ].join("\n");
  const source = [
    '"use client";',
    'import { cn } from "@/components/ui/class-names";',
    "// tracking-wide was never compiled",
    'export const ENV = "font-display tracking-wide";',
    "export const OVERLINE = cn(",
    '  "tracking-overline motion-safe:hover:scale-(--scale-hover)",',
    '  "border-(length:--border-width-thin) group",',
    ");",
  ].join("\n");

  it("reads the class words of a module, its imports and directives aside", () => {
    expect(classLiteralsOf(source)).toEqual([
      "font-display",
      "tracking-wide",
      "tracking-overline",
      "motion-safe:hover:scale-(--scale-hover)",
      "border-(length:--border-width-thin)",
      "group",
    ]);
  });

  it("detects tracking-wide, which no token compiles (constat C3), minified and with CRLF", () => {
    for (const [shape, sheet] of Object.entries(variants(built))) {
      expect(
        findClassesWithoutRule(classLiteralsOf(source), sheet),
        shape,
      ).toEqual(["tracking-wide: no rule of the build names this class"]);
    }
  });

  it("finds variants, arbitrary values and the group marker in the selectors", () => {
    const compiled = compiledClasses(built);
    expect(compiled.has("motion-safe:hover:scale-(--scale-hover)")).toBe(true);
    expect(compiled.has("border-(length:--border-width-thin)")).toBe(true);
    expect(compiled.has("group")).toBe(true);
  });

  it("accepts a justified entry, and reports a stale one", () => {
    const classes = classLiteralsOf(source);
    expect(findClassesWithoutRule(classes, built, ["tracking-wide"])).toEqual(
      [],
    );
    expect(
      findClassesWithoutRule(classes, built, [
        "tracking-wide",
        "font-display",
        "never-written",
      ]),
    ).toEqual([
      "font-display: stale entry, compiled",
      "never-written: stale entry, no class names it",
    ]);
  });
});

describe("TK7.3: no fluid size nor letter-spacing under KEO", () => {
  it("reads the fluid typography of the vitrine in the values: its classes, refused under KEO by G8", () => {
    expect(fluidTypographyClasses(tokensWith())).toEqual([
      "text-lead",
      "text-heading-3",
    ]);
  });

  it("accepts fixed sizes under KEO, the fluid ones left to the vitrine", () => {
    expect(
      findFluidKeoTypography(
        tokensWith("--text-md: 1rem;", "--tracking-heading: -0.025em;"),
      ),
    ).toEqual([]);
  });

  it("detects a clamp( or a vw declared under KEO, and a fixed name aliased to a fluid one", () => {
    const css = tokensWith(
      "--text-md: clamp(1rem, 0.9rem + 0.5vw, 1.125rem);",
      "--tracking-heading: 0.1vw;",
      "--text-lead: clamp(1rem, 1rem + 1vw, 2rem);",
      "--text-title: var(--text-heading-3);",
    );
    for (const [shape, sheet] of Object.entries(variants(css))) {
      expect(findFluidKeoTypography(sheet), shape).toEqual([
        '--text-md: "clamp(1rem, 0.9rem + 0.5vw, 1.125rem)" follows the window under KEO',
        '--text-lead: "clamp(1rem, 1rem + 1vw, 2rem)" follows the window under KEO',
        '--text-title: "clamp(1.25rem, 1.162rem + 0.3756vw, 1.5rem)" follows the window under KEO',
        '--tracking-heading: "0.1vw" follows the window under KEO',
      ]);
    }
  });
});

describe("TK7.5: no font smoothing on the document; badge-error-bg confined to the badge", () => {
  it("accepts the antialiased utility and a smoothing on the KEO container", () => {
    const css = [
      ".antialiased{-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}",
      '[data-theme="keo"]{-webkit-font-smoothing:antialiased}',
      "html{color-scheme:dark}",
      "body .x{-webkit-font-smoothing:antialiased}",
    ].join("\n");
    expect(findDocumentSmoothing(css)).toEqual([]);
  });

  it("detects a smoothing declared on :root, html or body, by property or @apply, minified and with CRLF", () => {
    const css = [
      "@layer base {",
      "  html { -webkit-font-smoothing: antialiased; }",
      "  :root { -moz-osx-font-smoothing: grayscale; }",
      '  html[data-cookie-banner="open"] body { @apply antialiased; }',
      "}",
    ].join("\n");
    for (const [shape, sheet] of Object.entries(variants(css))) {
      expect(findDocumentSmoothing(sheet), shape).toEqual([
        "html: declares a font smoothing (-webkit-font-smoothing: antialiased;)",
        ":root: declares a font smoothing (-moz-osx-font-smoothing: grayscale;)",
        'html[data-cookie-banner="open"] body: declares a font smoothing (@apply antialiased;)',
      ]);
    }
  });

  it("confines a token to its files: a use elsewhere and a missing listed file are reported, a comment is not", () => {
    const front = path.join(TEMP_ROOT, "front");
    const write = (relative: string, content: string) => {
      const file = path.join(front, relative);
      mkdirSync(path.dirname(file), { recursive: true });
      writeFileSync(file, content);
    };
    const badge = "src/components/member/ui/status-badge-classes.ts";
    write(badge, 'export const ERROR = "bg-badge-error-bg";\n');
    write(
      "src/components/member/ui/notice-classes.ts",
      [
        "// never bg-badge-error-bg on a notice (D72)",
        'export const NOTICE = "bg-feedback-error-bg";',
        'export const WRONG = "hover:bg-badge-error-bg";',
        'export const LONGER = "bg-badge-error-bg-strong";',
      ].join("\n"),
    );
    expect(findTokenUseOutside(front, "badge-error-bg", [badge])).toEqual([
      'src/components/member/ui/notice-classes.ts:3: export const WRONG = "hover:bg-badge-error-bg";',
    ]);
    expect(
      findTokenUseOutside(front, "badge-error-bg", [
        badge,
        "src/components/member/ui/Gone.tsx",
      ]),
    ).toContain(
      "src/components/member/ui/Gone.tsx: listed as allowed to use badge-error-bg, does not exist",
    );
  });
});

/** The pair of a badge's text on its ground, at 4.5:1 (20 §11.4; TK4.2, RK-11). */
const BADGE_PAIRS = [
  ["--color-feedback-success-text", "--color-feedback-success-bg"],
  ["--color-feedback-warning-text", "--color-feedback-warning-bg"],
  ["--color-feedback-info-text", "--color-feedback-info-bg"],
  ["--color-verified-text", "--color-verified-bg"],
  ["--color-feedback-error-text", "--color-badge-error-bg"],
  ["--color-text-secondary", "--color-surface-raised"],
] as const;

describe("TK4.2 (data): the filled badges are pairs of the G3d matrix", () => {
  it("lists the text of each badge on its own ground, at 4.5:1 at least, under KEO", () => {
    const missing = BADGE_PAIRS.filter(
      ([foreground, background]) =>
        !CONTRAST_MATRIX.keo.some(
          (pair) =>
            pair.kind === "contrast" &&
            pair.foreground === foreground &&
            pair.background === background &&
            pair.min >= 4.5,
        ),
    );
    expect(missing).toEqual([]);
  });
});
