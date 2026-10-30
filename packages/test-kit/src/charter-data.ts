// The data of the token guards of the DS milestone (D73; docs/mvp/18-plan-de-test-mvp.md §5.1 G3c
// and G3d, docs/mvp/20-direction-design.md §11.3 and §11.4). The guards compute and decide nothing:
// what is inherited, what is vitrine-only, which pairs are checked and at which floor are data, in
// this one module, that `expert-ux` keeps up to date. A floor goes down only by a written decision
// of the founder (CLAUDE.md §4). Read by apps/web and apps/backoffice (same tokens.css, same data).
import type { Charter, ColorMixAllowance, TokenPair } from "./guards.ts";

// ---------------------------------------------------------------------------------------------
// G3c: the --color-* that the KEO block does not redefine (02 §21.3 point 2; 20 §11.3, last table)
// ---------------------------------------------------------------------------------------------

/**
 * Colors that keep their vitrine value under KEO. Each entry says why; a stale entry (not a color
 * of @theme, or redefined in the KEO block) fails G3c.
 */
export const KEO_INHERITS: readonly string[] = [
  // The scrim behind a dialog is the same black at 70% in both charters (a `::backdrop` inherits it).
  "--color-overlay-scrim",
  // The red of danger, opaque and identical in both fronts and both charters (D72, G3b).
  "--color-feedback-error-text",
  "--color-feedback-error-bg",
  "--color-feedback-error-border",
  "--color-feedback-error-icon",
  "--color-border-error",
  "--color-action-danger-bg",
  "--color-action-danger-bg-hover",
  "--color-action-danger-bg-active",
  "--color-decorative-progress",
  // Tinted fills and borders, already opaque and validated (D6), identical in both charters: the
  // translucent `rgba` of the KEO mockup is replaced by these (20 §11.3).
  "--color-brand-subtle-bg",
  "--color-surface-brand-subtle",
  "--color-brand-subtle-border",
  "--color-feedback-success-bg",
  "--color-feedback-success-border",
  "--color-feedback-warning-bg",
  "--color-feedback-warning-border",
  "--color-feedback-info-bg",
  "--color-feedback-info-border",
  // Roles born with D73, which the vitrine has no use for: @theme already carries the KEO value (or
  // an alias of a token that does not move), so there is nothing to redefine.
  "--color-role-advertiser",
  "--color-role-creator",
  "--color-verified-text",
  "--color-verified-border",
  "--color-data-3",
];

/**
 * Colors of the vitrine that nothing consumes under KEO (G8 is its counterpart: a listed token
 * cannot be consumed there). Not redefined, and exempt from the closure of the aliases.
 */
export const VITRINE_ONLY: readonly string[] = [
  // The banner of the former mockup (D44), gone from the product; the token outlives it.
  "--color-mockup-banner-bg",
  "--color-mockup-banner-border",
  "--color-mockup-banner-text",
  // Landing effects (D59): the hero halo and the inverse (light) accents of the metal card.
  "--color-overlay-hero-halo",
  "--color-action-inverse-bg",
  "--color-action-secondary-inverse-border",
  "--color-text-inverse-secondary",
  "--color-text-accent-on-inverse",
  "--color-surface-inverse-raised",
  "--color-border-inverse",
  "--color-focus-ring-inverse",
  // The repartition bar of the landing (net suspended, D48).
  "--color-data-advertiser-share",
  "--color-data-creator-share",
  "--color-data-net-creator",
];

/**
 * Aliases of @theme that the KEO block redeclares towards another target, on purpose. Each entry
 * says why; any other retargeted alias, and a stale entry, fails G3c (findAliasClosureGaps).
 */
export const KEO_RETARGETED: readonly string[] = [
  // One family in the vitrine; under KEO, Manrope for titles and figures, Source Sans 3 for the
  // body (20 §11.5, 02 §21.4).
  "--font-display",
];

// ---------------------------------------------------------------------------------------------
// G3i (a): the brand green mixed with transparency, in the halos only (D75 RK-A; 20 §11.5)
// ---------------------------------------------------------------------------------------------

/**
 * The tokens of the KEO block that may hold `color-mix(in srgb, var(--color-brand-primary) N%,
 * transparent)`: the glow of the primary button at rest and on hover, and the header glow, at 15 %
 * at most. Never a `--color-*`, a text, the ground of a card nor a border.
 */
export const KEO_COLOR_MIX: readonly ColorMixAllowance[] = [
  { name: "--effect-action-glow" },
  { name: "--effect-action-glow-hover" },
  { name: "--background-image-header-glow", maxPercent: 15 },
];

// ---------------------------------------------------------------------------------------------
// G8: what the member pages never consume (02 §21.6; 18 §5.1)
// ---------------------------------------------------------------------------------------------

/**
 * Words that mark a token of the landing's effects (D59: metal card, hero, phone frame, halo,
 * former mockup banner). A token whose name holds one is consumed by the landing only, like the
 * colors of VITRINE_ONLY.
 */
export const VITRINE_TOKEN_MARKERS: readonly string[] = [
  "metal",
  "hero",
  "phone",
  "halo",
  "mockup",
];

// ---------------------------------------------------------------------------------------------
// G3d: the matrix of contrasts and the hue gap of the success, per charter (20 §11.3, §11.4)
// ---------------------------------------------------------------------------------------------

/** Minimum HSL hue gap, in degrees, of the success to the action and to the information. */
export const SUCCESS_MIN_HUE_GAP = 20;

const TEXT_MIN = 4.5;
const NON_TEXT_MIN = 3;

type Surface = readonly string[];

function contrasts(
  foregrounds: readonly string[],
  backgrounds: Surface,
  min: number,
): TokenPair[] {
  return foregrounds.flatMap((foreground) =>
    backgrounds.map((background): TokenPair => ({
      kind: "contrast",
      foreground,
      background,
      min,
    })),
  );
}

const PAGE = "--color-surface-page";
const CARD = "--color-surface-card";
const MUTED = "--color-surface-muted";
const RAISED = "--color-surface-raised";
const HOVER = "--color-surface-hover";
const ACTIVE = "--color-surface-active";
const SUBTLE = "--color-brand-subtle-bg";

/**
 * The red of danger on every surface a message can appear on (D72, G3b): the text 4,5:1, the border
 * of a field 3:1, the solid button against its page and its text. Shared by G3b and the matrix.
 */
export const DANGER_PAIRS: readonly TokenPair[] = [
  ...contrasts(["--color-feedback-error-text"], [PAGE, CARD, RAISED], TEXT_MIN),
  ...contrasts(
    ["--color-feedback-error-border"],
    [PAGE, CARD, RAISED],
    NON_TEXT_MIN,
  ),
  ...contrasts(
    ["--color-text-on-danger"],
    [
      "--color-action-danger-bg",
      "--color-action-danger-bg-hover",
      "--color-action-danger-bg-active",
    ],
    TEXT_MIN,
  ),
  ...contrasts(["--color-action-danger-bg"], [PAGE], NON_TEXT_MIN),
];

const SUCCESS_HUE_PAIRS: readonly TokenPair[] = [
  "--color-action-primary-bg",
  "--color-action-primary-bg-hover",
  "--color-action-primary-bg-active",
  "--color-feedback-info-text",
].flatMap((other) =>
  ["--color-feedback-success-text", "--color-feedback-success-icon"].map(
    (success): TokenPair => ({
      kind: "hue",
      first: success,
      second: other,
      min: SUCCESS_MIN_HUE_GAP,
    }),
  ),
);

/**
 * Pairs checked per charter. Only pairs that the charter really paints are listed: a pair absent
 * here is not forbidden by the guard, it is forbidden by `20` §11.4 (G3h, axe and the probe TD3
 * see the usage). Forbidden pairs are NOT listed because they fail: `text-tertiary` and the error
 * text on `surface-active` (4,13 and 3,91), `text-disabled` (exempt, WCAG 1.4.3).
 */
export const CONTRAST_MATRIX: Readonly<Record<Charter, readonly TokenPair[]>> =
  {
    keo: [
      // Texts, on the surfaces they may sit on (20 §11.4, first table).
      ...contrasts(
        [
          "--color-text-primary",
          "--color-text-secondary",
          "--color-text-brand",
        ],
        [PAGE, CARD, MUTED, RAISED, HOVER, ACTIVE, SUBTLE],
        TEXT_MIN,
      ),
      ...contrasts(
        ["--color-text-tertiary"],
        [PAGE, CARD, MUTED, RAISED, HOVER, SUBTLE],
        TEXT_MIN,
      ),
      ...contrasts(
        ["--color-feedback-success-text", "--color-feedback-success-icon"],
        [PAGE, CARD, RAISED, HOVER, ACTIVE],
        TEXT_MIN,
      ),
      ...contrasts(
        ["--color-feedback-warning-text"],
        [PAGE, CARD, RAISED, HOVER],
        TEXT_MIN,
      ),
      ...contrasts(
        ["--color-feedback-info-text", "--color-verified-text"],
        [PAGE, CARD, RAISED, HOVER],
        TEXT_MIN,
      ),
      ...contrasts(
        ["--color-role-advertiser", "--color-role-creator"],
        [PAGE, CARD, RAISED, HOVER],
        TEXT_MIN,
      ),
      ...contrasts(["--color-feedback-error-text"], [HOVER], TEXT_MIN),
      // Texts on the fill of their own family (second table).
      ...contrasts(
        ["--color-text-on-action"],
        [
          "--color-action-primary-bg",
          "--color-action-primary-bg-hover",
          "--color-action-primary-bg-active",
        ],
        TEXT_MIN,
      ),
      ...contrasts(["--color-counter-text"], ["--color-counter-bg"], TEXT_MIN),
      ...contrasts(
        ["--color-text-primary"],
        [
          "--color-feedback-success-bg",
          "--color-feedback-warning-bg",
          "--color-feedback-info-bg",
        ],
        TEXT_MIN,
      ),
      ...contrasts(
        ["--color-feedback-success-text"],
        ["--color-feedback-success-bg"],
        TEXT_MIN,
      ),
      ...contrasts(
        ["--color-feedback-warning-text"],
        ["--color-feedback-warning-bg"],
        TEXT_MIN,
      ),
      ...contrasts(
        ["--color-feedback-info-text"],
        ["--color-feedback-info-bg"],
        TEXT_MIN,
      ),
      // Non-text, 3:1: border of a field and of the secondary button, the shape of the main button,
      // the indicator of the active item, the focus ring, the series of a chart.
      ...contrasts(
        ["--color-border-strong", "--color-action-secondary-border"],
        [PAGE, CARD, RAISED, HOVER],
        NON_TEXT_MIN,
      ),
      ...contrasts(
        ["--color-border-error"],
        [PAGE, CARD, RAISED, HOVER],
        NON_TEXT_MIN,
      ),
      ...contrasts(["--color-action-primary-bg"], [PAGE, CARD], NON_TEXT_MIN),
      ...contrasts(
        ["--color-nav-item-active-indicator"],
        [HOVER],
        NON_TEXT_MIN,
      ),
      ...contrasts(["--color-focus-ring"], [PAGE, HOVER], NON_TEXT_MIN),
      ...contrasts(
        ["--color-data-1", "--color-data-2", "--color-data-3"],
        [CARD],
        NON_TEXT_MIN,
      ),
      ...DANGER_PAIRS,
      ...SUCCESS_HUE_PAIRS,
    ],
    vitrine: [
      ...contrasts(
        [
          "--color-text-primary",
          "--color-text-secondary",
          "--color-text-tertiary",
        ],
        [PAGE, CARD, RAISED],
        TEXT_MIN,
      ),
      ...contrasts(
        [
          "--color-feedback-success-text",
          "--color-feedback-warning-text",
          "--color-feedback-info-text",
        ],
        [PAGE, CARD],
        TEXT_MIN,
      ),
      ...contrasts(
        ["--color-text-on-action"],
        [
          "--color-action-primary-bg",
          "--color-action-primary-bg-hover",
          "--color-action-primary-bg-active",
        ],
        TEXT_MIN,
      ),
      ...contrasts(
        ["--color-border-strong", "--color-action-primary-bg"],
        [PAGE, CARD],
        NON_TEXT_MIN,
      ),
      ...DANGER_PAIRS,
      ...SUCCESS_HUE_PAIRS,
    ],
  };

/** The derived color of the header glow's peak, laid over the page (`withGlowPeak`; RK-9). */
export const GLOW_PEAK = "--derived-header-glow-peak";

/**
 * The texts and the shape that may sit at the peak of the header glow (20 §11.4, "au pic du halo"):
 * the composite of the glow over the page, about `#0d291d`. Kept apart from CONTRAST_MATRIX, whose
 * pairs are all declared tokens; the G3d test of each front checks both.
 */
export const GLOW_PEAK_PAIRS: readonly TokenPair[] = [
  ...contrasts(
    ["--color-text-primary", "--color-text-secondary", "--color-text-tertiary"],
    [GLOW_PEAK],
    TEXT_MIN,
  ),
  ...contrasts(["--color-feedback-error-text"], [GLOW_PEAK], TEXT_MIN),
  ...contrasts(["--color-border-strong"], [GLOW_PEAK], NON_TEXT_MIN),
];

// ---------------------------------------------------------------------------------------------
// G3g and G3h: where the role colors live, which pairs of classes never go together (20 §11.3, §11.4)
// ---------------------------------------------------------------------------------------------

/** The component that alone consumes `role-advertiser` and `role-creator` (G3g; 20 §11.3, F4). */
export const ROLE_COLOR_COMPONENTS: readonly string[] = [
  "src/components/member/ui/RoleBadge.tsx",
];

/**
 * Surfaces and the foregrounds that fail AA on them (20 §11.4, consequence 1): tertiary text is
 * 4.13:1 and error text 3.91:1 on `surface-active`, which carries `text-primary` only.
 */
export const FORBIDDEN_CLASS_PAIRS: ReadonlyArray<{
  surface: string;
  foregrounds: readonly string[];
}> = [
  {
    surface: "bg-surface-active",
    foregrounds: [
      "text-text-tertiary",
      "text-text-muted",
      "text-feedback-error-text",
    ],
  },
];
