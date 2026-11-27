// The couples mockup ↔ application of the visual acceptance (docs/mvp/22-refonte-ux-ui/05 §3 and §8;
// RUA-03, jalons/rub/modele-archi.md §6): one per screen and state of its mockup (`E01.0:marque-neuve`),
// the lines of its N2 matrix named after the sheet (`E01.0-S07`, `E01a` §3), with the selectors of each
// side. Each screen jalon (RUB and after) adds its couples with its screen, and runs them under
// E2E_VISUAL=app (e2e/visual/app.spec.ts). A couple never names a backoffice window from 768 to
// 1 023 px (RU-19), never a mask outside 05 §3, never a state that is not one of the mockup's, never a
// line of another screen: `coupleProblems` says why.
import type { MaskKind } from "./compare";
import { isMaskKind } from "./compare";
import type { StyleProbe, VisualZone } from "./capture";
import {
  MOCKUPS,
  statesOf,
  visualWindowRefusal,
  VISUAL_WINDOWS,
  type VisualWindow,
} from "./mockups";
import type {
  loadBackofficeSpace,
  loadBrandSpace,
  loadCreatorSpace,
} from "../recette";

/** One side of a selector pair: the mockup's and the application's. */
export type Paired = { mockup: string; app: string };

/** How the application's page is reached: a loader of support/recette.ts and its options (05 §4). */
export type AppLoad =
  | {
      space: "brand";
      options: NonNullable<Parameters<typeof loadBrandSpace>[1]>;
    }
  | {
      space: "creator";
      options: NonNullable<Parameters<typeof loadCreatorSpace>[1]>;
    }
  | {
      space: "backoffice";
      options: NonNullable<Parameters<typeof loadBackofficeSpace>[1]>;
    };

export type VisualCouple = {
  /** The screen and the state of its mockup: `E01.0:marque-neuve`, `E04:matin`. */
  id: `E${string}:${string}`;
  mockup: { file: string; state: string };
  /**
   * The application's page: its front, its path (fr), the loader that signs it in, and the selector
   * whose presence says the page is drawn (its reads of the API answered).
   */
  app: {
    front: "web" | "backoffice";
    path: string;
    load: AppLoad;
    ready: string;
  };
  /** The windows of the couple; those of the mockup's space when absent. */
  windows?: readonly VisualWindow[];
  /** The part of the page whose zones (landmarks) N1 reads in order, on each side. */
  structure: Paired;
  /**
   * The parts N1 reads line by line (roles, names, wordings, icons), on each side; the whole
   * `structure` when empty. A part absent or hidden on both sides at a width is empty there.
   */
  parts: readonly ({ name: string } & Paired)[];
  /** The N2 matrix (§3 of the sheet): a line `E..-S..` of the screen and a selector on each side. */
  matrix: readonly (Pick<StyleProbe, "name"> & Paired)[];
  /** The N3 zones: a name and a selector on each side (null: the viewport). */
  zones: readonly (Pick<VisualZone, "name"> & {
    mockup: string | null;
    app: string | null;
  })[];
  /** The N3 masks (05 §3 only). */
  masks: readonly ({ kind: MaskKind } & Paired)[];
  /** The `{variable}` values of the wordings, excluded from N1. */
  variables: readonly RegExp[];
};

// The member shell of the application (MemberShell.tsx), read by its structure and its data-*
// attributes only: the shell is not changed for its comparison.
const APP_COLUMN = "div:has(> [data-member-nav])";
const APP_HEADER = `${APP_COLUMN} > header`;
const APP_STATE = `${APP_COLUMN} > aside > div:first-child`;
const APP_FOOT = `${APP_COLUMN} > aside > div:last-child`;

/**
 * E01.0, the member shell, against proto-accueils.html (E01a §2, §3): the lines S02 to S16 this mockup
 * shows (S08 and S09, the ancestor and the sub-entries, are proto-compte's), the zones of N3 in RUB
 * (the column, the header, the navigation: the content of the home, E01.1, is out of zone before RUE,
 * never masked), and the address of the account masked (05 §3).
 */
function shellCouple(state: string, path: string, load: AppLoad): VisualCouple {
  return {
    id: `E01.0:${state}`,
    mockup: { file: "proto-accueils.html", state },
    // The state of the account, read after the session: the last read of the shell.
    app: { front: "web", path, load, ready: `${APP_STATE} > p` },
    structure: { mockup: ".m-col", app: APP_COLUMN },
    // The aside « Votre compte » holds the state and the foot (RUB-B §1): each read on its own.
    parts: [
      { name: "header", mockup: ".m-head", app: APP_HEADER },
      { name: "navigation", mockup: ".m-nav", app: "[data-member-nav]" },
      { name: "state", mockup: ".m-state", app: APP_STATE },
      { name: "foot", mockup: ".m-foot", app: APP_FOOT },
    ],
    matrix: [
      // The grid read on its column (256 px, full height, from lg): the height of the frame follows
      // the content of the page, out of zone before RUE.
      { name: "E01.0-S02", mockup: ".m-col", app: APP_COLUMN },
      {
        name: "E01.0-S03",
        mockup: ".m-brand",
        app: `${APP_HEADER} > a:first-child`,
      },
      {
        name: "E01.0-S04",
        mockup: ".m-head .role",
        app: `${APP_HEADER} > span`,
      },
      {
        name: "E01.0-S05",
        mockup: ".m-head .btn",
        app: `${APP_HEADER} > a[hreflang]`,
      },
      {
        name: "E01.0-S06",
        mockup: ".m-nav__link:not(.is-current)",
        app: "[data-member-nav] > ul > li > a:not([aria-current])",
      },
      {
        name: "E01.0-S07",
        mockup: ".m-nav__link.is-current",
        app: '[data-member-nav] a[aria-current="page"]',
      },
      {
        name: "E01.0-S10",
        mockup: ".m-nav__cell",
        app: "[data-member-nav] > ul > li",
      },
      {
        name: "E01.0-S11",
        mockup: ".m-state b",
        app: `${APP_STATE} > p:first-child`,
      },
      {
        name: "E01.0-S12",
        mockup: ".m-state .c2",
        app: `${APP_STATE} > p:nth-child(2)`,
      },
      { name: "E01.0-S13", mockup: ".m-state .go", app: `${APP_STATE} > a` },
      {
        name: "E01.0-S14",
        mockup: ".m-foot .btn:first-child",
        app: `${APP_FOOT} > a[hreflang]`,
      },
      { name: "E01.0-S15", mockup: ".m-foot p", app: `${APP_FOOT} > p` },
      {
        name: "E01.0-S16",
        mockup: ".m-foot .btn:last-child",
        app: `${APP_FOOT} > button`,
      },
    ],
    zones: [
      { name: "column", mockup: ".m-col", app: APP_COLUMN },
      { name: "header", mockup: ".m-head", app: APP_HEADER },
      { name: "navigation", mockup: ".m-nav", app: "[data-member-nav]" },
    ],
    masks: [
      { kind: "account-email", mockup: ".m-foot p", app: `${APP_FOOT} > p` },
    ],
    // The address of the account, the count of what is missing, and the addresses of the links: every
    // link of a mockup points to `#contenu`, and N1 compares wordings, roles and names, not targets.
    variables: [
      /[a-z0-9.+-]+@example\.test/,
      /\d+ informations manquantes/,
      /(?<=\/url: ).+/,
    ],
  };
}

/** The couples of the jalons: the four states of the member shell in RUB (line 11). */
export const VISUAL_COUPLES: readonly VisualCouple[] = [
  shellCouple("marque-neuve", "/fr/marque", {
    space: "brand",
    options: { profile: "draft" },
  }),
  shellCouple("marque", "/fr/marque", {
    space: "brand",
    options: { profile: "published" },
  }),
  shellCouple("createur-neuf", "/fr/createur", {
    space: "creator",
    options: { profile: "bare" },
  }),
  shellCouple("createur", "/fr/createur", {
    space: "creator",
    options: { profile: "published" },
  }),
];

const COUPLE_ID = /^(E\d{2}[a-z]?(?:\.\d)?):([a-z0-9-]+)$/;

/** Why the couples cannot be compared, one line each; empty when they all can. */
export function coupleProblems(couples: readonly VisualCouple[]): string[] {
  const seen = new Set<string>();
  return couples.flatMap((couple) => {
    const problems: string[] = [];
    const id = COUPLE_ID.exec(couple.id);
    if (id === null) {
      problems.push(`${couple.id}: not an identifier E..:<state>`);
    } else if (id[2] !== couple.mockup.state) {
      problems.push(
        `${couple.id}: the state of the identifier is not ${couple.mockup.state}`,
      );
    }
    if (seen.has(couple.id)) problems.push(`${couple.id}: declared twice`);
    seen.add(couple.id);
    const line = id === null ? null : new RegExp(`^${id[1]}-S\\d{2}$`);
    for (const probe of couple.matrix) {
      if (line !== null && !line.test(probe.name)) {
        problems.push(
          `${couple.id}: ${probe.name} is not a line of the matrix of ${id?.[1] ?? ""}`,
        );
      }
    }
    const mockup = MOCKUPS.find(
      (candidate) => candidate.file === couple.mockup.file,
    );
    if (mockup === undefined) {
      problems.push(`${couple.id}: ${couple.mockup.file} is not a mockup`);
      return problems;
    }
    if (!statesOf(mockup).includes(couple.mockup.state)) {
      problems.push(
        `${couple.id}: ${couple.mockup.state} is not a state of ${mockup.file}`,
      );
    }
    for (const window of couple.windows ?? VISUAL_WINDOWS[mockup.space]) {
      const refusal = visualWindowRefusal(mockup.space, window);
      if (refusal !== null) problems.push(`${couple.id}: ${refusal}`);
    }
    for (const mask of couple.masks) {
      if (!isMaskKind(mask.kind)) {
        problems.push(
          `${couple.id}: "${String(mask.kind)}" is not a mask of 05 §3`,
        );
      }
    }
    if (couple.matrix.length === 0) {
      problems.push(`${couple.id}: no line of the N2 matrix`);
    }
    if (couple.zones.length === 0) problems.push(`${couple.id}: no N3 zone`);
    return problems;
  });
}
