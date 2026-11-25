// The couples mockup ↔ application of the visual acceptance (docs/mvp/22-refonte-ux-ui/05 §3 and §8;
// RUA-03): one per state of a screen sheet (`E..-S..`), with the selectors of each side. Empty in RUA:
// each screen jalon (RUB and after) adds its couples with its screen, and runs them under
// E2E_VISUAL=app. A couple never names a backoffice window from 768 to 1 023 px (RU-19), never a
// mask outside 05 §3, never a state that is not one of the mockup's: `coupleProblems` says why.
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

/** One side of a selector pair: the mockup's and the application's. */
export type Paired = { mockup: string; app: string };

export type VisualCouple = {
  /** The state of the screen sheet: `E02-S03`, `E05b-S01`. */
  id: `E${string}-S${string}`;
  mockup: { file: string; state: string };
  /** The application's page: its path on the front (fr), and how it is reached (RUB). */
  app: { front: "web" | "backoffice"; path: string };
  /** The windows of the couple; those of the mockup's space when absent. */
  windows?: readonly VisualWindow[];
  /** The N2 matrix (§3 of the sheet): a name and a selector on each side. */
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

/** The couples of the jalons; none in RUA (no screen is compared before RUB). */
export const VISUAL_COUPLES: readonly VisualCouple[] = [];

const COUPLE_ID = /^E\d{2}[a-z]?-S\d{2}$/;

/** Why the couples cannot be compared, one line each; empty when they all can. */
export function coupleProblems(couples: readonly VisualCouple[]): string[] {
  const seen = new Set<string>();
  return couples.flatMap((couple) => {
    const problems: string[] = [];
    if (!COUPLE_ID.test(couple.id)) {
      problems.push(`${couple.id}: not an identifier E..-S..`);
    }
    if (seen.has(couple.id)) problems.push(`${couple.id}: declared twice`);
    seen.add(couple.id);
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
