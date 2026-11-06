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
  findDynamicSegmentViolations,
  findNetworkOrStorageUse,
  findNonLiteralSlugs,
  findPagesRouterDirectories,
  findPlatformExportViolations,
  findPlatformFileCopies,
  findPrimitiveBaseClassConflicts,
  findRelayContentViolations,
  findRelayFingerprintMismatches,
  findRelayImporterViolations,
  findRouteFileViolations,
  findVitrineSnapshotChanges,
  PLATFORM_EXPORTS,
  WEB_STRUCTURAL_SEGMENTS,
  PLATFORM_NETWORK_FILES,
  HARD_CODED_COLOR_PATTERN,
  HARD_CODED_LENGTH_PATTERN,
  isValidUtf8,
  listFiles,
  relativePath,
  BO_TOKEN_MARKER,
  effectiveTokens,
  findAliasClosureGaps,
  findKeoActivationViolations,
  findMemberGroupMismatches,
  findPortalUse,
  findStateTransforms,
  findVitrineImportsUnder,
  findVitrineTokenUse,
  tokenScopes,
  findCharterFileCopies,
  findTokensImportViolations,
  findFontViolations,
  findForbiddenClassPairs,
  findRoleColorUse,
  findSessionReadViolations,
  findKeoBlocksOutside,
  findKeoBlockViolations,
  findTokenPairFailures,
  findDocumentSmoothing,
  findFluidKeoTypography,
  findKeoTrapViolations,
  findTokenUseOutside,
  fluidTypographyClasses,
  hueGap,
  keoBlocks,
  DANGER_RED_TOKENS,
  OPAQUE_TOKEN_VALUE,
  TRANSLUCENT_RED_CLASS,
  withGlowPeak,
  type Charter,
} from "@influx/test-kit/guards";
import {
  CONTRAST_MATRIX,
  DANGER_PAIRS,
  FORBIDDEN_CLASS_PAIRS,
  GLOW_PEAK,
  GLOW_PEAK_PAIRS,
  KEO_COLOR_MIX,
  KEO_INHERITS,
  KEO_RETARGETED,
  ROLE_COLOR_COMPONENTS,
  SUCCESS_MIN_HUE_GAP,
  VITRINE_ONLY,
  VITRINE_TOKEN_MARKERS,
} from "@influx/test-kit/charter-data";
import { MEMBER_PAGE_SLUGS } from "@/lib/member-paths";
import { describe, expect, it } from "vitest";

const WEB_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

/** apps/web serves its public health route beside the relay (EC-22). */
const WEB_ROUTES = { healthRoute: true } as const;
const SRC = path.join(WEB_ROOT, "src");
/** packages/ui: the tokens and the fonts of both fronts live there (arbitration PL-07, PL-08). */
const BACKOFFICE_ROOT = path.resolve(WEB_ROOT, "..", "backoffice");
const UI_ROOT = path.resolve(WEB_ROOT, "..", "..", "packages", "ui");
const UI_SRC = path.join(UI_ROOT, "src");
const TOKENS_FILE = path.join(UI_SRC, "styles", "tokens.css");
const GLOBALS = "src/app/globals.css";
/** packages/web-platform: the relay, its browser client, the collector and the marker (PL-07, PL-09). */
const PLATFORM_ROOT = path.resolve(
  WEB_ROOT,
  "..",
  "..",
  "packages",
  "web-platform",
);
const PLATFORM_SRC = path.join(PLATFORM_ROOT, "src");

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
// T10.6), and the ESLint ban of `fetch` outside src/server/api-client.ts (c, J1), in
// packages/web-platform since PL-09.
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
  const TOKEN_FILES = new Set(["src/styles/image-sizes.ts"]);
  const files = SCOPED_FILES.filter((file) => !TOKEN_FILES.has(relative(file)));

  it("finds no hexadecimal color or color function", () => {
    expect(findMatches(HARD_CODED_COLOR_PATTERN, files)).toEqual([]);
  });

  it("finds no literal length (px, rem, em, vh, vw, ch)", () => {
    expect(findMatches(HARD_CODED_LENGTH_PATTERN, files)).toEqual([]);
  });

  it("keeps tokens.css valid UTF-8", () => {
    expect(isValidUtf8(TOKENS_FILE)).toBe(true);
  });

  it("finds no hexadecimal color or literal length in the files of packages/ui beside its tokens", () => {
    const uiFiles = listFiles(UI_SRC).filter(
      (file) => /.(ts|tsx|json|css)$/.test(file) && file !== TOKENS_FILE,
    );
    expect(uiFiles.length).toBeGreaterThan(0);
    for (const pattern of [
      HARD_CODED_COLOR_PATTERN,
      HARD_CODED_LENGTH_PATTERN,
    ]) {
      expect(findMatchesIn(pattern, uiFiles, UI_ROOT)).toEqual([]);
    }
  });

  it("finds no hexadecimal color, literal length, literal URL or mailto in packages/web-platform (G1 to G3, PL-09)", () => {
    const platformFiles = listFiles(PLATFORM_SRC).filter((file) =>
      /\.(ts|tsx|json|css)$/.test(file),
    );
    expect(platformFiles.length).toBeGreaterThan(5);
    for (const pattern of [
      HARD_CODED_COLOR_PATTERN,
      HARD_CODED_LENGTH_PATTERN,
      /\b(?:https?|wss?):\/\//,
      /mailto:|\btel:/,
    ]) {
      expect(findMatchesIn(pattern, platformFiles, PLATFORM_ROOT)).toEqual([]);
    }
  });

  it("keeps a single tokens file, in packages/ui, marked with its D6 and D73 status", () => {
    const cssFiles = listFiles(SRC)
      .filter((file) => file.endsWith(".css"))
      .map(relative);
    expect(cssFiles.sort()).toEqual([GLOBALS]);
    expect(
      listFiles(UI_SRC)
        .filter((file) => file.endsWith(".css"))
        .map((file) => relativePath(UI_ROOT, file)),
    ).toEqual(["src/styles/tokens.css"]);
    expect(findCharterFileCopies(WEB_ROOT)).toEqual([]);
    expect(findTokensImportViolations(WEB_ROOT, [GLOBALS])).toEqual([]);
    const tokens = readFileSync(TOKENS_FILE, "utf8");
    expect(tokens.slice(0, 400)).toContain("D6 tranchée");
    expect(tokens.slice(0, 400)).toContain("D73");
    expect(
      readFileSync(path.join(SRC, "app", "globals.css"), "utf8"),
    ).not.toMatch(/--color-[\w-]+\s*:/);
  });
});

/** The tokens.css with one more declaration at the end of its KEO block, where it wins (negative cases). */
function withKeoDeclaration(css: string, declaration: string): string {
  const lastDeclaration = "    --radius-card: 1rem;\n";
  expect(css).toContain(lastDeclaration);
  return css.replace(lastDeclaration, `${lastDeclaration}    ${declaration}\n`);
}

const CHARTERS = ["vitrine", "keo"] as const;

describe("G3b: the red of danger is opaque and shared by both fronts and both charters (zone-de-danger fiche §5, D73)", () => {
  const tokens = readFileSync(TOKENS_FILE, "utf8");
  // Read per charter, aliases followed: tokenValue reads the first occurrence, the vitrine, and
  // would leave the KEO block unchecked.
  const value = (css: string, charter: Charter, name: string): string =>
    effectiveTokens(css, charter).get(name) ?? "";

  for (const charter of CHARTERS) {
    it(`gives every danger token a 6-digit hex, transparent or var() value (${charter})`, () => {
      for (const name of DANGER_RED_TOKENS) {
        expect(value(tokens, charter, name), name).toMatch(OPAQUE_TOKEN_VALUE);
      }
    });

    it(`has the same values as the other front, which imports the same file (${charter})`, () => {
      expect(findTokensImportViolations(BACKOFFICE_ROOT, [GLOBALS])).toEqual(
        [],
      );
      expect(findCharterFileCopies(BACKOFFICE_ROOT)).toEqual([]);
      for (const name of DANGER_RED_TOKENS) {
        expect(value(tokens, charter, name), name).toMatch(OPAQUE_TOKEN_VALUE);
      }
    });

    it(`keeps the contrast ratios of §5, recomputed from the file (${charter})`, () => {
      expect(
        findTokenPairFailures(effectiveTokens(tokens, charter), DANGER_PAIRS),
      ).toEqual([]);
    });
  }

  it("keeps the same red under KEO as in the vitrine (KEO_INHERITS), the text on it excepted", () => {
    for (const name of DANGER_RED_TOKENS) {
      if (name === "--color-text-on-danger") continue;
      expect(value(tokens, "keo", name), name).toBe(
        value(tokens, "vitrine", name),
      );
    }
  });

  it("fails on a KEO red that is too weak, while the vitrine still passes (negative case)", () => {
    const weak = withKeoDeclaration(
      tokens,
      "--color-feedback-error-text: #7a1f1f;",
    );
    expect(
      findTokenPairFailures(effectiveTokens(weak, "keo"), DANGER_PAIRS),
    ).not.toEqual([]);
    expect(
      findTokenPairFailures(effectiveTokens(weak, "vitrine"), DANGER_PAIRS),
    ).toEqual([]);
  });

  it("tints no red with an opacity modifier or a color function", () => {
    expect(findMatches(TRANSLUCENT_RED_CLASS, SCOPED_FILES)).toEqual([]);
  });
});

// G3c (D73, 02 §21.3, 18 §5.1): one KEO block, in tokens.css; every color redefined, inherited
// (KEO_INHERITS) or vitrine-only (VITRINE_ONLY); no value that is not opaque; the aliases closed.
describe("G3c: the KEO block is unique, complete, opaque and closes its aliases (02 §21.3)", () => {
  const tokens = readFileSync(TOKENS_FILE, "utf8");
  const lists = { inherits: KEO_INHERITS, vitrineOnly: VITRINE_ONLY } as const;

  it("holds exactly one KEO block, inside @layer base, in tokens.css and in no other sheet", () => {
    expect(keoBlocks(tokens)).toHaveLength(1);
    expect(tokens).toMatch(/@layer base\s*\{\s*\[data-theme="keo"\]\s*\{/);
    const sheets = [...listFiles(SRC), ...listFiles(UI_SRC)].filter((file) =>
      file.endsWith(".css"),
    );
    expect(sheets).toContain(TOKENS_FILE);
    expect(findKeoBlocksOutside(sheets, TOKENS_FILE, WEB_ROOT)).toEqual([]);
  });

  it("declares declared names only, opaque, and accounts for every --color-*", () => {
    expect(findKeoBlockViolations(tokens, lists)).toEqual([]);
  });

  it("redeclares every alias whose target KEO redefines (the browser resolves aliases on :root)", () => {
    expect(findAliasClosureGaps(tokens, VITRINE_ONLY, KEO_RETARGETED)).toEqual(
      [],
    );
  });

  it("fails on an alias left on its vitrine value, a translucent color and a forgotten color (negative cases)", () => {
    const forgotten = tokens.replace(
      "    --color-text-on-danger: var(--color-text-primary);\n",
      "",
    );
    expect(forgotten).not.toBe(tokens);
    expect(
      findAliasClosureGaps(forgotten, VITRINE_ONLY, KEO_RETARGETED),
    ).toEqual([
      "--color-text-on-danger: alias of --color-text-primary, redefined in the KEO block, " +
        "but not redeclared there (it would keep its vitrine value)",
    ]);
    expect(
      findKeoBlockViolations(
        withKeoDeclaration(
          tokens,
          "--color-brand-primary: rgba(29, 214, 138, 0.14);",
        ),
        lists,
      ),
    ).toEqual([
      '--color-brand-primary: "rgba(29, 214, 138, 0.14)" is not an opaque value',
    ]);
    expect(
      findKeoBlockViolations(tokens, {
        inherits: KEO_INHERITS.filter((name) => name !== "--color-data-3"),
        vitrineOnly: VITRINE_ONLY,
      }),
    ).toEqual([
      "--color-data-3: neither redefined in the KEO block, nor in KEO_INHERITS, nor in VITRINE_ONLY",
    ]);
  });
});

// The guards of the RK milestone on the sources (D75; 02 §21.3 point 3; 18 §5.1, TK7.1, TK7.3, TK7.5).
// A case that the code before the milestone fails is an `it.fails` named after the commit that frees
// it (RK-n); that commit turns it into a plain `it`. G3i (b) and TK7.2 read the build (RK-3, RK-5).
describe("G3i (a), TK7.3 and TK7.5: no inscribed KEO token, no fluid size, no smoothing on the document", () => {
  const tokens = readFileSync(TOKENS_FILE, "utf8");

  it("redefines no token of a namespace that Tailwind inscribes, color-mix in the tokens of RK-A only (G3i a)", () => {
    expect(findKeoTrapViolations(tokens, KEO_COLOR_MIX)).toEqual([]);
  });

  it("lets no fluid size nor letter-spacing through to KEO (TK7.3)", () => {
    expect(findFluidKeoTypography(tokens)).toEqual([]);
  });

  it("declares no font smoothing on :root, html or body (TK7.5)", () => {
    const sheets = [TOKENS_FILE, path.join(SRC, "app", "globals.css")];
    expect(
      sheets.flatMap((sheet) =>
        findDocumentSmoothing(readFileSync(sheet, "utf8")),
      ),
    ).toEqual([]);
  });

  it("paints badge-error-bg on the error badge alone, never a notice (TK7.5, D72)", () => {
    expect(
      findTokenUseOutside(WEB_ROOT, "badge-error-bg", [
        "src/components/member/ui/status-badge-classes.ts",
      ]),
    ).toEqual([]);
  });
});

// G3d (D73, 18 §5.1, 20 §11.4): the matrix of contrasts per charter and the hue gap of the success.
// The pairs, the floors and SUCCESS_MIN_HUE_GAP are data (@influx/test-kit/charter-data): the guard
// computes, it decides nothing. What it does not see (a usage not listed) is left to axe and TD3.
describe("G3d: contrasts and success hue, per charter (20 §11.3, §11.4)", () => {
  const tokens = readFileSync(TOKENS_FILE, "utf8");

  for (const charter of CHARTERS) {
    it(`holds every pair of the ${charter} matrix at its floor`, () => {
      expect(CONTRAST_MATRIX[charter].length).toBeGreaterThan(30);
      expect(
        findTokenPairFailures(
          effectiveTokens(tokens, charter),
          CONTRAST_MATRIX[charter],
        ),
      ).toEqual([]);
    });
  }

  it("holds the texts and the field border at the peak of the header glow, about #0d291d (RK-9)", () => {
    const keo = effectiveTokens(tokens, "keo");
    const withPeak = withGlowPeak(keo, GLOW_PEAK);
    expect(withPeak.get(GLOW_PEAK)).toBe("#0d291d");
    expect(findTokenPairFailures(withPeak, GLOW_PEAK_PAIRS)).toEqual([]);
    // A glow past the 15 % ceiling sinks the tertiary text and the error red: the pairs see it.
    const strong = withGlowPeak(
      effectiveTokens(
        withKeoDeclaration(
          tokens,
          "--background-image-header-glow: radial-gradient(ellipse 50% 16rem at 50% 0%, color-mix(in srgb, var(--color-brand-primary) 45%, transparent), transparent);",
        ),
        "keo",
      ),
      GLOW_PEAK,
    );
    expect(findTokenPairFailures(strong, GLOW_PEAK_PAIRS)).not.toEqual([]);
  });

  it("gives the success its own color per charter, 20 degrees or more from the action", () => {
    const keo = effectiveTokens(tokens, "keo");
    const vitrine = effectiveTokens(tokens, "vitrine");
    expect(keo.get("--color-feedback-success-text")).toBe("#3ccfcf");
    expect(vitrine.get("--color-feedback-success-text")).toBe("#3ccfcf");
    for (const tokenSet of [keo, vitrine]) {
      expect(
        hueGap(
          tokenSet.get("--color-feedback-success-text") ?? "",
          tokenSet.get("--color-action-primary-bg") ?? "",
        ),
      ).toBeGreaterThanOrEqual(SUCCESS_MIN_HUE_GAP);
    }
  });

  it("fails on a KEO success too close to the green and on a KEO surface that sinks a text (negative cases)", () => {
    const failures = findTokenPairFailures(
      effectiveTokens(
        withKeoDeclaration(
          withKeoDeclaration(tokens, "--color-feedback-success-text: #4ade80;"),
          "--color-surface-card: #3a3a3a;",
        ),
        "keo",
      ),
      CONTRAST_MATRIX.keo,
    );
    expect(failures.some((line) => line.includes(": hue 1"))).toBe(true);
    expect(
      failures.some((line) =>
        line.includes("/ --color-surface-card (#3a3a3a)"),
      ),
    ).toBe(true);
    // The same surface edit, made in the KEO block, leaves the vitrine matrix untouched.
    expect(
      findTokenPairFailures(
        effectiveTokens(
          withKeoDeclaration(tokens, "--color-surface-card: #3a3a3a;"),
          "vitrine",
        ),
        CONTRAST_MATRIX.vitrine,
      ),
    ).toEqual([]);
  });
});

// G3f skeleton (D73, 18 §5.1): the backoffice-only tokens stay in the backoffice. The other half,
// tokens-backoffice.css declaring `--*-bo-*` only, is in apps/backoffice/tests/guards.test.ts.
describe("G3f: no backoffice token in apps/web", () => {
  it("finds no -bo- name anywhere in src/", () => {
    expect(findMatches(BO_TOKEN_MARKER, SCOPED_FILES)).toEqual([]);
  });
});

// G8 (D73, 02 §21.3 to §21.6, 18 §5.1): the two charters of apps/web kept apart, one case per
// rule. The detectors are self-tested in the test-kit (TD1.10).
describe("G8: the KEO charter stays inside the member pages, the vitrine outside them", () => {
  const MEMBER_LAYOUT = "src/app/[locale]/(member)/layout.tsx";
  /** What renders under KEO: the member group and the components only it uses. */
  const KEO_SCOPES = [
    "src/app/[locale]/(member)",
    "src/components/member",
    "src/components/auth",
    "src/components/account",
  ];
  /** Modules of the landing (D59), each one checked to exist. */
  const VITRINE_MODULES = [
    "src/components/landing",
    "src/content/landing-content.ts",
    "src/content/landing-images.ts",
    "src/content/images",
    "src/components/ui/AudienceDoors.tsx",
    "src/components/ui/PhoneFrame.tsx",
    "src/components/ui/ResponsiveImage.tsx",
    "src/components/ui/ShortVideoOverlay.tsx",
  ];
  const tokens = readFileSync(TOKENS_FILE, "utf8");

  it("sets data-theme and imports @influx/ui/fonts in the member layout only", () => {
    expect(findKeoActivationViolations(WEB_ROOT, [MEMBER_LAYOUT])).toEqual([]);
  });

  it("uses no createPortal anywhere in src/ (02 §21.3 point 5)", () => {
    expect(findPortalUse(WEB_ROOT)).toEqual([]);
  });

  it("imports no module of the landing under the KEO scopes", () => {
    expect(
      findVitrineImportsUnder(WEB_ROOT, KEO_SCOPES, VITRINE_MODULES),
    ).toEqual([]);
  });

  it("consumes no vitrine-only token under the KEO scopes (VITRINE_ONLY, landing effects)", () => {
    const { theme, root } = tokenScopes(tokens);
    const marker = new RegExp(VITRINE_TOKEN_MARKERS.join("|"));
    const effects = [...theme.keys(), ...root.keys()].flatMap((name) => {
      const at = name.search(marker);
      return at === -1 ? [] : [name.slice(at)];
    });
    const colors = VITRINE_ONLY.map((name) => name.replace("--color-", ""));
    expect(effects).toContain("metal-card");
    expect(
      findVitrineTokenUse(WEB_ROOT, KEO_SCOPES, [...colors, ...effects]),
    ).toEqual([]);
  });

  it("transforms a state under motion-safe: only and never transitions all (20 §11.5, F6)", () => {
    expect(findStateTransforms(WEB_ROOT, KEO_SCOPES)).toEqual([]);
  });

  // G8 extended (D75 RK-5; 18 §5.1, TK7.3): the fluid sizes stay with the vitrine.
  it("uses no class of the vitrine's fluid typography under the KEO scopes (TK7.3)", () => {
    expect(
      findVitrineTokenUse(WEB_ROOT, KEO_SCOPES, fluidTypographyClasses(tokens)),
    ).toEqual([]);
  });

  it("serves exactly the pages of MEMBER_PAGE_SLUGS from the (member) group, URLs unchanged", () => {
    const memberPaths = Object.values(MEMBER_PAGE_SLUGS).flatMap((slugs) =>
      Object.values(slugs),
    );
    expect(memberPaths).toHaveLength(24); // 12 pages, two languages (SN-1: the page-menu of mon compte; L2B-11: the brand profile)
    expect(
      findMemberGroupMismatches(
        WEB_ROOT,
        "src/app/[locale]",
        "(member)",
        memberPaths,
      ),
    ).toEqual([]);
  });
});

// G9 (D73; 02 §21.5 point 1, §21.9): the session is read by the member shell alone, which hands
// it to the pages through useMember(). The detector is self-tested in the test-kit (TD1.12).
describe("G9: the session read confined to the member shell", () => {
  it("imports readMe in MemberShell only, and reads GET /v1/me in member-auth only", () => {
    expect(
      findSessionReadViolations(WEB_ROOT, {
        module: "src/components/auth/member-auth.ts",
        reader: "readMe",
        endpoint: "/v1/me",
        shells: ["src/components/member/MemberShell.tsx"],
      }),
    ).toEqual([]);
  });
});

// G3g (D73, 20 §11.3, F4): the role colors mark a role visually and nothing else; one component
// consumes them and requires the role written. The detector is self-tested in the test-kit.
describe("G3g: the role colors are consumed by the role component alone (P7, 12 RG7)", () => {
  it("uses role-advertiser and role-creator nowhere but in RoleBadge, whose label is required", () => {
    expect(findRoleColorUse(WEB_ROOT, ROLE_COLOR_COMPONENTS)).toEqual([]);
  });
});

// G3h (D73, 20 §11.4): no tertiary text, no error text on surface-active, which carries text-primary
// only. A weak net by design (the same literal); axe checks the rest.
describe("G3h: no forbidden pair of classes in one literal (20 §11.4)", () => {
  it("paints neither tertiary text nor error text on surface-active under the KEO scopes", () => {
    expect(
      findForbiddenClassPairs(
        WEB_ROOT,
        [
          "src/app/[locale]/(member)",
          "src/components/member",
          "src/components/auth",
          "src/components/account",
        ],
        FORBIDDEN_CLASS_PAIRS,
      ),
    ).toEqual([]);
  });
});

// G4f (D73, 18 §5.1, TD1.9): self-hosted fonts. The detector is self-tested in the test-kit.
describe("G4f: fonts are unmodified, listed, licensed, within budget and held once, in packages/ui", () => {
  it("finds no violation in the fonts directory of packages/ui", () => {
    expect(findFontViolations(UI_ROOT)).toEqual([]);
  });

  it("keeps no copy of the fonts, the manifest or fonts.ts in apps/web and apps/backoffice", () => {
    expect(findCharterFileCopies(WEB_ROOT)).toEqual([]);
    expect(findCharterFileCopies(BACKOFFICE_ROOT)).toEqual([]);
  });
});

// G3e (D73, 18 §5.1, TD4.1): the vitrine frozen before the first change of the DS milestone (DS-1).
// The snapshot holds every declaration of @theme, :root and the @media blocks; additions are
// allowed, a change or a removal fails. Changing the snapshot is a commit that names the values.
// It sees neither a shared component nor globals.css: e2e/vitrine-unchanged.spec.ts (TD4.2) does.
describe("G3e: the vitrine tokens stay those of the snapshot (D59, TD4.1)", () => {
  const snapshot = JSON.parse(
    readFileSync(
      path.join(WEB_ROOT, "tests", "fixtures", "vitrine-tokens-d59.json"),
      "utf8",
    ),
  ) as Record<string, Record<string, string>>;
  const tokens = readFileSync(TOKENS_FILE, "utf8");

  it("keeps every declaration of @theme, :root and @media", () => {
    expect(Object.keys(snapshot)).toEqual(
      expect.arrayContaining([
        "@theme static",
        ":root",
        "@media (width >= 768px) > :root",
        "@media (width >= 1024px) > :root",
        "@media (prefers-reduced-motion: reduce) > :root",
      ]),
    );
    expect(findVitrineSnapshotChanges(snapshot, tokens)).toEqual([]);
  });

  it("fails on a changed vitrine value (self-check on the real file)", () => {
    const changed = tokens.replace(
      "--color-action-primary-bg: #1dd68a;",
      "--color-action-primary-bg: #29e075;",
    );
    expect(changed).not.toBe(tokens);
    expect(findVitrineSnapshotChanges(snapshot, changed)).toEqual([
      '@theme static --color-action-primary-bg: "#1dd68a" became "#29e075"',
    ]);
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

// J4S-7: the error collector sends location.pathname (error-collector.ts l. 42); a name or a handle
// in a connected-space path would reach `ops`. Segments are opaque identifiers or fixed words.
describe("J4S-7: no name or handle in a member path", () => {
  it("carries no dynamic segment outside the closed list in any tree of src/app (L2AT-4)", () => {
    expect(
      findDynamicSegmentViolations(
        path.join(WEB_ROOT, "src", "app"),
        undefined,
        WEB_STRUCTURAL_SEGMENTS,
      ),
    ).toEqual([]);
  });

  it("writes every localized page slug as a literal of letters, digits, hyphens and slashes", () => {
    expect(findNonLiteralSlugs(MEMBER_PAGE_SLUGS)).toEqual([]);
  });
});

// G5 ("no route.ts under src/app", CA8) was lifted at J1 in the commit that introduced the relay,
// and replaced by this stricter guard (02 §13.1, 18 §5, 21 §4 J1-C). The landing page still never
// reaches the network: only the route file imports the relay, which alone imports the API client.
describe("G5 replaced: the relay is the only server endpoint (21 J1-C, 03 PP-12)", () => {
  it("has exactly two route files under src/app: the relay and the health route (EC-22)", () => {
    expect(findRouteFileViolations(WEB_ROOT, WEB_ROUTES)).toEqual([]);
  });

  it("has no Pages Router directory, pages/ nor src/pages/ (18 §5 G5 b)", () => {
    expect(findPagesRouterDirectories(WEB_ROOT)).toEqual([]);
  });

  it("keeps data-layer imports, Server Actions and environment reads out of the relay", () => {
    expect(
      findRelayContentViolations(WEB_ROOT, PLATFORM_ROOT, WEB_ROUTES),
    ).toEqual([]);
  });

  it("reaches the API client along a single chain: route files, relay, API client, config", () => {
    expect(
      findRelayImporterViolations(WEB_ROOT, PLATFORM_ROOT, WEB_ROUTES),
    ).toEqual([]);
  });

  it("matches the pinned SHA-256 of the four relay files, the route here and the rest in packages/web-platform (T7.8)", () => {
    expect(findRelayFingerprintMismatches(WEB_ROOT, PLATFORM_ROOT)).toEqual([]);
  });

  it("keeps no copy of a file of packages/web-platform, whose exports stay frozen (arbitration PL-07)", () => {
    expect(findPlatformFileCopies(WEB_ROOT, PLATFORM_ROOT)).toEqual([]);
    expect(findPlatformExportViolations(PLATFORM_ROOT)).toEqual([]);
    expect(Object.keys(PLATFORM_EXPORTS)).not.toContain("./api-client");
    expect(existsSync(path.join(SRC, "server", "relay.ts"))).toBe(false);
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
      "brand-profile.json",
      "creator-profile.json",
      "errors.json",
      "landing.json",
      "legal.json",
      "member.json",
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
    expect(findBrowserRelayClientMismatches(PLATFORM_ROOT)).toEqual([]);
    const source = readFileSync(
      path.join(PLATFORM_ROOT, BROWSER_RELAY_CLIENT_FILE),
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
  // Since PL-09 both network files are in packages/web-platform: no file of apps/web calls fetch.
  it("uses no storage API, and no network API outside the API client (CA8, CA11)", () => {
    const codeFiles = SCOPED_FILES.filter((file) => /\.tsx?$/.test(file));
    expect(findNetworkOrStorageUse(codeFiles, WEB_ROOT)).toEqual([]);
    const platformFiles = listFiles(PLATFORM_SRC).filter((file) =>
      /\.tsx?$/.test(file),
    );
    expect(
      findNetworkOrStorageUse(
        platformFiles,
        PLATFORM_ROOT,
        PLATFORM_NETWORK_FILES,
      ),
    ).toEqual([]);
  });

  it("loads no tracker, keeps the cookie banner off and the footer Cookies link (EC-J9-3, J9T-6)", () => {
    const codeFiles = SCOPED_FILES.filter((file) => /\.tsx?$/.test(file));
    // a tracker comes in by next/script or a <script src>: none exists while the banner is off
    expect(findMatches(/from\s+["']next\/script["']/, codeFiles)).toEqual([]);
    expect(findMatches(/<script\b[^>]*\bsrc=/, codeFiles)).toEqual([]);
    const consent = readFileSync(
      path.join(SRC, "components/landing/cookie-consent.ts"),
      "utf8",
    );
    expect(consent).toMatch(
      /export const IS_COOKIE_BANNER_ENABLED: boolean = false;/,
    );
    const footer = readFileSync(
      path.join(SRC, "components/landing/SiteFooter.tsx"),
      "utf8",
    );
    expect(footer).toMatch(/id: "cookies", document: "cookie_policy"/);
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
    // The primitives of the spaces too (DS-5): they take className like the landing's.
    const primitiveFiles = [
      ...listFiles(path.join(SRC, "components", "ui")),
      ...listFiles(path.join(SRC, "components", "member", "ui")),
    ].filter((file) => file.endsWith(".tsx"));
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

  // Formerly "identical to that of apps/backoffice": the copy became one file of
  // packages/web-platform (PL-09), mounted by the shell of each connected space only.
  it("keeps the collector once, in packages/web-platform, imported by the two shells only", () => {
    expect(existsSync(path.join(PLATFORM_ROOT, COLLECTOR))).toBe(true);
    for (const front of [WEB, BACKOFFICE_ROOT]) {
      expect(existsSync(path.join(front, COLLECTOR)), front).toBe(false);
    }
    const importers = [WEB, BACKOFFICE_ROOT].flatMap((front) =>
      listFiles(path.join(front, "src"))
        .filter((file) => /\.tsx?$/.test(file))
        .filter((file) =>
          readFileSync(file, "utf8").includes(
            '"@influx/web-platform/error-collector"',
          ),
        )
        .map((file) => relativePath(path.dirname(front), file)),
    );
    expect(importers.sort()).toEqual([
      "backoffice/src/components/Shell.tsx",
      "web/src/components/member/MemberShell.tsx",
    ]);
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
    // The specifier is @influx/web-platform/error-collector since PL-09: both names are checked.
    const importers = landing.filter((file) =>
      /observability|error-collector/.test(readFileSync(file, "utf8")),
    );
    expect(importers).toEqual([]);
  });
});

// TN9 (D74, SN-4): the section-link pills are gone, and the connected space draws one <nav>, in its
// shell and the nav component extracted from it. Comment lines are skipped: they may speak of a <nav>.
type SourceFile = { file: string; source: string };

function findNavLandmarks(
  sources: readonly SourceFile[],
  allowed: readonly string[],
): string[] {
  return sources
    .filter(
      ({ file, source }) =>
        !allowed.includes(file) &&
        source
          .split("\n")
          .some(
            (line) =>
              !/^\s*(?:\/\/|\*|\/\*)/.test(line) && /<nav[\s>]/.test(line),
          ),
    )
    .map(({ file }) => file);
}

function findSectionPills(sources: readonly SourceFile[]): string[] {
  return sources
    .filter(({ source }) => source.includes("sectionLinkClasses"))
    .map(({ file }) => file);
}

describe("TN9: no section-link pills, one <nav> in the member space (D74)", () => {
  const MEMBER_NAV_FILES = [
    "src/components/member/MemberShell.tsx",
    "src/components/member/MemberNav.tsx",
  ];
  const sources: SourceFile[] = SCOPED_FILES.filter((file) =>
    /\.tsx?$/.test(file),
  ).map((file) => ({
    file: relative(file),
    source: readFileSync(file, "utf8"),
  }));
  const memberSpace = sources.filter(({ file }) =>
    /^src\/(?:components\/(?:member|account)|app\/\[locale\]\/\(member\))\//.test(
      file,
    ),
  );

  it("keeps no occurrence of sectionLinkClasses in src", () => {
    expect(findSectionPills(sources)).toEqual([]);
  });

  it("draws <nav> in the member shell and its nav component only", () => {
    expect(memberSpace.length).toBeGreaterThan(10);
    expect(findNavLandmarks(memberSpace, MEMBER_NAV_FILES)).toEqual([]);
  });

  it("refuses a made-up page that draws its own <nav> or brings the pills back", () => {
    const fake = {
      file: "src/components/account/Fake.tsx",
      source:
        'const c = sectionLinkClasses(true);\nreturn <nav aria-label="x" />;',
    };
    expect(findNavLandmarks([fake], MEMBER_NAV_FILES)).toEqual([fake.file]);
    expect(findSectionPills([fake])).toEqual([fake.file]);
    expect(
      findNavLandmarks(
        [{ file: fake.file, source: "// never a <nav>\n * a <nav> here" }],
        MEMBER_NAV_FILES,
      ),
    ).toEqual([]);
  });
});
