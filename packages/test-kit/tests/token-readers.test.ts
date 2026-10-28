// Self-checks of the token readers of the DS milestone (docs/mvp/18-plan-de-test-mvp.md §5.1 and
// §12.1, TD1.1 to TD1.8; 02 §21.3): a reader that reads the wrong block is a guard that lies (G7).
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import {
  effectiveTokens,
  findAliasClosureGaps,
  findKeoBlocksOutside,
  findKeoBlockViolations,
  findTokenPairFailures,
  findVitrineSnapshotChanges,
  hueDistance,
  hueGap,
  hueOf,
  keoBlocks,
  meetsHueGap,
  tokenValue,
  vitrineDeclarations,
  type TokenPair,
} from "../src/guards.ts";

const TEMP_ROOT = mkdtempSync(path.join(tmpdir(), "influx-token-readers-"));

afterAll(() => {
  rmSync(TEMP_ROOT, { recursive: true, force: true });
});

/** A tokens.css shaped like the real one: @theme, :root, @media, and a KEO block in @layer base. */
function tokensCss(keo: string | null = KEO_BLOCK): string {
  return [
    "@theme static {",
    "  --*: initial;",
    "  --color-action: #22c55e;",
    "  --color-success: #2dd4bf;",
    "  --color-surface: #0a0a0a;",
    "  --color-text: #f5f5f7;",
    "  --color-muted: #86868f;",
    "  --color-border-strong: #74747c;",
    "  --color-secondary-border: var(--color-border-strong);",
    "  --font-base: system-ui, sans-serif;",
    "}",
    ":root {",
    "  --header-height: 4rem;",
    "  --menu-max: calc(100dvh - var(--header-height));",
    "}",
    "@media (width >= 1024px) {",
    "  :root {",
    "    --header-height: 4.5rem;",
    "  }",
    "}",
    ...(keo === null ? [] : ["@layer base {", keo, "}"]),
  ].join("\n");
}

const KEO_BLOCK = [
  '  [data-theme="keo"] {',
  "    --color-action: #1dd68a;",
  "    --color-surface: #0a0b0a;",
  "    --color-text: #f4f6f5;",
  "    --color-border-strong: #78827d;",
  "    --color-secondary-border: var(--color-border-strong);",
  '    --font-base: "Source Sans 3", system-ui, sans-serif;',
  "  }",
].join("\n");

/** A KEO block made of the given declarations. */
function keoWith(...declarations: string[]): string {
  return `[data-theme="keo"] {\n${declarations.join("\n")}\n}`;
}

const LISTS = {
  inherits: ["--color-success"],
  vitrineOnly: ["--color-muted"],
} as const;

describe("TD1.1: the KEO block, absent, duplicated or outside tokens.css", () => {
  it("finds exactly one block in the reference file, inside @layer base", () => {
    expect(keoBlocks(tokensCss())).toHaveLength(1);
    expect(findKeoBlockViolations(tokensCss(), LISTS)).toEqual([]);
  });

  it("reports an absent block, and refuses to read the KEO charter without it", () => {
    expect(findKeoBlockViolations(tokensCss(null), LISTS)).toEqual([
      "0 KEO blocks: exactly one is expected",
    ]);
    expect(() => effectiveTokens(tokensCss(null), "keo")).toThrow(
      "no KEO block",
    );
  });

  it("reports a duplicated block, and refuses to read either", () => {
    const twice = `${tokensCss()}\n${keoWith("  --color-action: #1dd68a;")}`;
    expect(findKeoBlockViolations(twice, LISTS)).toEqual([
      "2 KEO blocks: exactly one is expected",
    ]);
    expect(() => effectiveTokens(twice, "keo")).toThrow("2 KEO blocks");
  });

  it("reports a block in any other stylesheet, whatever its quotes", () => {
    const tokens = path.join(TEMP_ROOT, "styles", "tokens.css");
    const other = path.join(TEMP_ROOT, "app", "globals.css");
    const plain = path.join(TEMP_ROOT, "app", "plain.css");
    mkdirSync(path.dirname(tokens), { recursive: true });
    mkdirSync(path.dirname(other), { recursive: true });
    writeFileSync(tokens, tokensCss());
    writeFileSync(other, "[data-theme='keo'] { --color-action: #1dd68a; }");
    writeFileSync(plain, "body { margin: 0; }");
    expect(
      findKeoBlocksOutside([tokens, other, plain], tokens, TEMP_ROOT),
    ).toEqual(["app/globals.css: holds a KEO block"]);
  });
});

describe("TD1.2: the effective value per charter, aliases followed", () => {
  it("reads @theme then :root for the vitrine, never the KEO block nor an @media", () => {
    const vitrine = effectiveTokens(tokensCss(), "vitrine");
    expect(vitrine.get("--color-action")).toBe("#22c55e");
    expect(vitrine.get("--color-secondary-border")).toBe("#74747c");
    expect(vitrine.get("--header-height")).toBe("4rem");
    expect(vitrine.get("--menu-max")).toBe("calc(100dvh - 4rem)");
    expect(vitrine.has("--*")).toBe(false);
  });

  it("reads the KEO block, else @theme, else :root, for the name and for its targets", () => {
    const keo = effectiveTokens(tokensCss(), "keo");
    expect(keo.get("--color-action")).toBe("#1dd68a");
    // Inherited from @theme, then from :root.
    expect(keo.get("--color-success")).toBe("#2dd4bf");
    expect(keo.get("--menu-max")).toBe("calc(100dvh - 4rem)");
    // The alias follows its target into the KEO block.
    expect(keo.get("--color-secondary-border")).toBe("#78827d");
    expect(keo.get("--font-base")).toBe(
      '"Source Sans 3", system-ui, sans-serif',
    );
  });

  it("throws on a cycle and on a missing target", () => {
    const cycle = tokensCss(
      keoWith(
        "  --color-action: var(--color-text);",
        "  --color-text: var(--color-action);",
      ),
    );
    expect(() => effectiveTokens(cycle, "keo")).toThrow("alias cycle");
    expect(() => effectiveTokens(cycle, "vitrine")).not.toThrow();
    const missing = tokensCss(
      keoWith("  --color-action: var(--color-absent);"),
    );
    expect(() => effectiveTokens(missing, "keo")).toThrow(
      "missing alias target: --color-action refers to --color-absent",
    );
  });
});

describe("TD1.3: the closure of the aliases", () => {
  it("accepts an alias redeclared identically", () => {
    expect(findAliasClosureGaps(tokensCss())).toEqual([]);
  });

  it("detects a direct alias left on its vitrine value", () => {
    const css = tokensCss(keoWith("  --color-border-strong: #78827d;"));
    expect(findAliasClosureGaps(css)).toEqual([
      "--color-secondary-border: alias of --color-border-strong, redefined in the KEO block, " +
        "but not redeclared there (it would keep its vitrine value)",
    ]);
  });

  it("detects a two-level alias, even when the middle one is redeclared", () => {
    const css = tokensCss(
      keoWith(
        "  --color-border-strong: #78827d;",
        "  --color-secondary-border: var(--color-border-strong);",
      ),
    ).replace(
      "--font-base: system-ui, sans-serif;",
      "--font-base: system-ui, sans-serif;\n  --color-outline: var(--color-secondary-border);",
    );
    expect(findAliasClosureGaps(css)).toEqual([
      "--color-outline: alias of --color-secondary-border, --color-border-strong, redefined in " +
        "the KEO block, but not redeclared there (it would keep its vitrine value)",
    ]);
    // Neither level redeclared: both are left on their vitrine value.
    const neither = css.replace(
      "\n  --color-secondary-border: var(--color-border-strong);\n}",
      "\n}",
    );
    expect(findAliasClosureGaps(neither)).toEqual([
      "--color-secondary-border: alias of --color-border-strong, redefined in the KEO block, " +
        "but not redeclared there (it would keep its vitrine value)",
      "--color-outline: alias of --color-border-strong, redefined in the KEO block, " +
        "but not redeclared there (it would keep its vitrine value)",
    ]);
  });

  it("detects a calc(var(…)) in :root whose target is redefined", () => {
    const css = tokensCss(keoWith("  --header-height: 5rem;"));
    expect(findAliasClosureGaps(css)).toEqual([
      "--menu-max: alias of --header-height, redefined in the KEO block, " +
        "but not redeclared there (it would keep its vitrine value)",
    ]);
  });

  it("detects an alias redeclared towards another target, accepts a literal redefinition", () => {
    const other = tokensCss(
      keoWith("  --color-secondary-border: var(--color-text);"),
    );
    expect(findAliasClosureGaps(other)).toEqual([
      '--color-secondary-border: redeclared in the KEO block as "var(--color-text)", ' +
        'another target than "var(--color-border-strong)"',
    ]);
    const literal = tokensCss(
      keoWith(
        "  --color-border-strong: #78827d;",
        "  --color-secondary-border: #78827d;",
      ),
    );
    expect(findAliasClosureGaps(literal)).toEqual([]);
  });
});

describe("TD1.4: a reader insensitive to comments, one-line CSS and Windows line breaks", () => {
  it("ignores braces and declarations written in comments", () => {
    const css = tokensCss(
      [
        '[data-theme="keo"] {',
        "  /* } --color-action: #ff0000; { */",
        "  --color-action: #1dd68a; /* --color-text: #000000; */",
        "}",
        '/* [data-theme="keo"] { --color-text: #000000; } */',
      ].join("\n"),
    );
    expect(keoBlocks(css)).toHaveLength(1);
    const keo = effectiveTokens(css, "keo");
    expect(keo.get("--color-action")).toBe("#1dd68a");
    expect(keo.get("--color-text")).toBe("#f5f5f7");
    expect(tokenValue(css, "--color-action")).toBe("#22c55e");
  });

  it("reads the same values from one-line CSS and from CRLF line breaks", () => {
    const reference = effectiveTokens(tokensCss(), "keo");
    const oneLine = tokensCss().replace(/\n\s*/g, " ");
    const windows = tokensCss().replace(/\n/g, "\r\n");
    expect(effectiveTokens(oneLine, "keo")).toEqual(reference);
    expect(effectiveTokens(windows, "keo")).toEqual(reference);
    expect(vitrineDeclarations(windows)).toEqual(
      vitrineDeclarations(tokensCss()),
    );
  });
});

describe("TD1.5: translucent values, !important and typos in the KEO block", () => {
  it("detects rgba(, color-mix(, !important and a name absent from @theme and :root", () => {
    const css = tokensCss(
      keoWith(
        "  --color-action: rgba(29, 214, 138, 0.9);",
        "  --color-surface: color-mix(in srgb, #0a0b0a 90%, white);",
        "  --color-text: #f4f6f5 !important;",
        "  --color-acton: #1dd68a;",
        "  --color-border-strong: #78827d;",
        "  --color-secondary-border: var(--color-border-strong);",
      ),
    );
    expect(findKeoBlockViolations(css, LISTS)).toEqual([
      '--color-action: "rgba(29, 214, 138, 0.9)" is not an opaque value',
      '--color-surface: "color-mix(in srgb, #0a0b0a 90%, white)" is not an opaque value',
      "--color-text: !important in the KEO block",
      "--color-acton: declared neither in @theme nor in :root",
    ]);
  });
});

describe("TD1.6: every --color-* redefined, inherited or vitrine-only; no stale entry", () => {
  it("detects a color neither redefined nor listed", () => {
    expect(
      findKeoBlockViolations(tokensCss(), {
        inherits: [],
        vitrineOnly: ["--color-muted"],
      }),
    ).toEqual([
      "--color-success: neither redefined in the KEO block, nor in KEO_INHERITS, nor in VITRINE_ONLY",
    ]);
  });

  it("detects a stale entry: unknown, redefined, or in both lists", () => {
    expect(
      findKeoBlockViolations(tokensCss(), {
        inherits: ["--color-success", "--color-gone", "--color-action"],
        vitrineOnly: ["--color-muted", "--color-success"],
      }),
    ).toEqual([
      "--color-success: in both KEO_INHERITS and VITRINE_ONLY",
      "KEO_INHERITS: stale entry --color-gone, not a --color-* of @theme",
      "KEO_INHERITS: stale entry --color-action, redefined in the KEO block",
    ]);
  });
});

describe("TD1.7: the hue gap, with its threshold as a parameter", () => {
  // HSL hues (20 §11.3): #1dd68a 155.35°, #2dd4bf 172.46°, #3ccfcf 180°, #4ade80 141.89°.
  const ACTION = "#1dd68a";

  it("measures the gaps of 18 TD1.7 to the tenth of a degree", () => {
    expect(hueOf(ACTION)).toBeCloseTo(155.35, 2);
    expect(hueGap("#2dd4bf", ACTION)).toBeCloseTo(17.1, 1);
    expect(hueGap("#3ccfcf", ACTION)).toBeCloseTo(24.6, 1);
    expect(hueGap("#4ade80", ACTION)).toBeCloseTo(13.5, 1);
  });

  it("compares each gap with a threshold of 20°, then of 15°", () => {
    expect(
      ["#2dd4bf", "#3ccfcf", "#4ade80"].map((color) =>
        meetsHueGap(color, ACTION, 20),
      ),
    ).toEqual([false, true, false]);
    expect(
      ["#2dd4bf", "#3ccfcf", "#4ade80"].map((color) =>
        meetsHueGap(color, ACTION, 15),
      ),
    ).toEqual([true, true, false]);
  });

  it("refuses a gray, which has no hue", () => {
    expect(() => hueGap("#74747c", ACTION)).not.toThrow();
    expect(() => hueGap("#808080", ACTION)).toThrow("has no hue");
    expect(() => hueOf("#fff")).toThrow("not a 6-digit hex color");
  });

  it("goes through 0°: 350° and 10° are 20° apart", () => {
    expect(hueDistance(350, 10)).toBe(20);
    expect(hueDistance(10, 350)).toBe(20);
    // #ff0033 is at 348°, #ff3300 at 12°.
    expect(hueGap("#ff0033", "#ff3300")).toBeCloseTo(24, 6);
  });
});

describe("TD1.8: a pair under its floor in the KEO block fails, the same pair passes in the vitrine", () => {
  const PAIRS: readonly TokenPair[] = [
    {
      kind: "hue",
      first: "--color-success",
      second: "--color-action",
      min: 20,
    },
    {
      kind: "contrast",
      foreground: "--color-muted",
      background: "--color-surface",
      min: 4.5,
    },
  ];
  // Under KEO the action moves to #1dd68a (17.1° from the inherited success) and the surface to a
  // gray light enough to sink the muted text.
  const css = tokensCss(
    keoWith(
      "  --color-action: #1dd68a;",
      "  --color-surface: #3a3a3a;",
      "  --color-border-strong: #78827d;",
      "  --color-secondary-border: var(--color-border-strong);",
    ),
  );

  it("passes in the vitrine", () => {
    expect(
      findTokenPairFailures(effectiveTokens(css, "vitrine"), PAIRS),
    ).toEqual([]);
  });

  it("fails in the KEO block, pair by pair", () => {
    expect(findTokenPairFailures(effectiveTokens(css, "keo"), PAIRS)).toEqual([
      "--color-success (#2dd4bf) / --color-action (#1dd68a): hue 17.10 under 20",
      "--color-muted (#86868f) / --color-surface (#3a3a3a): contrast 3.15 under 4.5",
    ]);
  });

  it("reports a token missing from the set", () => {
    expect(
      findTokenPairFailures(new Map([["--color-action", "#1dd68a"]]), PAIRS),
    ).toEqual([
      "--color-success / --color-action: token missing",
      "--color-muted / --color-surface: token missing",
    ]);
  });
});

describe("G3e detector: the vitrine snapshot (TD4.1)", () => {
  const snapshot = vitrineDeclarations(tokensCss());

  it("freezes @theme, :root and @media, never the KEO block", () => {
    expect(Object.keys(snapshot)).toEqual([
      "@theme static",
      ":root",
      "@media (width >= 1024px) > :root",
    ]);
    expect(snapshot["@theme static"]?.["--color-action"]).toBe("#22c55e");
    expect(snapshot["@media (width >= 1024px) > :root"]).toEqual({
      "--header-height": "4.5rem",
    });
    expect(findVitrineSnapshotChanges(snapshot, tokensCss(null))).toEqual([]);
  });

  it("accepts an addition, detects a change and a removal", () => {
    const changed = tokensCss()
      .replace("--color-action: #22c55e;", "--color-action: #1dd68a;")
      .replace("    --header-height: 4.5rem;\n", "")
      .replace(
        "--header-height: 4rem;",
        "--header-height: 4rem;\n  --z-nav-bottom: 90;",
      );
    expect(findVitrineSnapshotChanges(snapshot, changed)).toEqual([
      '@theme static --color-action: "#22c55e" became "#1dd68a"',
      '@media (width >= 1024px) > :root --header-height: removed (was "4.5rem")',
    ]);
  });
});
