// The journey across a change of language (D66; docs/mvp/05 RG111, RG130; 17 §3 "Changement de
// langue"). The language link is a client navigation: the page of the other language mounts a new
// journey, which takes the state of the one left from here. A MODULE VARIABLE ONLY: never the
// browser's storage (02 §13.2, D37), never a cookie; a reload or another tab starts from the
// server's journey cookies instead (GET /v1/auth/journey).
// Written from effects and handlers only; read while rendering ONLY without side effect
// (peekForLocale): React may abandon a render and restart it, and the restart must find the same
// journey. The hand-over ends in an effect after the mount (discardHandedOver). On the server this
// module is shared by every visitor and must stay empty.
import type { SignupDoor } from "@influx/contracts/auth";
import type { AppLocale } from "@/i18n/routing";
import type { MemberPage } from "@/lib/member-paths";
import {
  languagePageOf,
  type JourneyEntry,
  type JourneyStep,
} from "./auth-steps";
import type { SignupDraft } from "./signup-form";

export type JourneySnapshot = {
  /** The language of the page that wrote it. */
  locale: AppLocale;
  entry: JourneyEntry;
  door: SignupDoor | null;
  /** Never a notice: a journey that ended is forgotten. */
  step: Exclude<JourneyStep, { kind: "notice" }>;
  /** The address typed on screen 1. */
  email: string;
  /** The answers of screen 3. */
  draft: SignupDraft;
};

let snapshot: JourneySnapshot | null = null;

/** Keeps the state of the journey on screen, replacing the previous one. */
export function remember(current: JourneySnapshot): void {
  // J9S-8: on the server the module is shared by every visitor, so it never keeps anything there.
  if (typeof window === "undefined") {
    return;
  }
  snapshot = current;
}

/**
 * The journey left in ANOTHER language: null when there is none, or when it was written in this
 * very language (a remount in the same language reads the server instead). It empties nothing, so
 * it is safe while rendering: an abandoned render that React restarts reads the same journey.
 */
export function peekForLocale(locale: AppLocale): JourneySnapshot | null {
  if (
    typeof window === "undefined" ||
    snapshot === null ||
    snapshot.locale === locale
  ) {
    return null;
  }
  return snapshot;
}

/**
 * Ends the hand-over, from an effect once the page has mounted: the journey left in another
 * language than `locale` is dropped, so that it is handed over once. The journey of `locale` itself
 * (written since by the mounted page) stays.
 */
export function discardHandedOver(locale: AppLocale): void {
  if (snapshot !== null && snapshot.locale !== locale) {
    snapshot = null;
  }
}

/** The journey ended (notice, success, restart): nothing is handed over any more. */
export function forget(): void {
  snapshot = null;
}

/** Whether a snapshot belongs to this page: the page its language link led to. */
export function snapshotFits(
  taken: JourneySnapshot,
  page: MemberPage,
): boolean {
  return languagePageOf(taken.entry, taken.door, taken.step) === page;
}
