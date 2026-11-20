// The anonymous profile a brand opens and its visuals, from the answer of the doors of the base to the
// strict contract (docs/mvp/10 RG15, RG41, RG42, RG48, RG50, RG65; CA6, CA49, CA50; D82 (7); jalons/l3f/
// modele.md §2, §3; fiche invariants 1 to 3). Nothing is read here but what a door returned, and its
// answer is checked WHOLE and strict before anything is chosen from it:
// - the creator of the profile is profiles.creator_layer_a() as the door serves it (no status, no key
//   of a line), shaped by THE public projection (profiles/creator/public-projection.ts), exactly as a
//   card of the search: never built here (CA6);
// - the region is the door's (search.displayed_region, null below the threshold), its reasons and note
//   the codes of the search;
// - a visual is the object of an approved one the door named: its bytes are read from Storage by the
//   key of the base and relayed as JSON, the key never in an answer nor a log line.
// A door's answer of another shape fails here (a 500), rather than reach a brand.
import {
  creatorSearchReasonSchema,
  creatorSearchVigilanceSchema,
} from "@influx/contracts/creator-search";
import {
  creatorSearchProfileResponseSchema,
  type CreatorSearchProfileResponse,
  type CreatorSearchVisualResponse,
} from "@influx/contracts/creator-search-profile";
import * as z from "zod";
import type { Transaction } from "../../../db/index.ts";
import { ApiError } from "../../../platform/errors.ts";
import type { ObjectStore } from "../../../platform/storage.ts";
import type { InMemberTransaction } from "../../profiles/brand-logo.ts";
import {
  PORTFOLIO_BUCKET,
  portfolioImageOf,
} from "../../profiles/creator/portfolio.ts";
import { searchCardProjectionOf } from "../../profiles/creator/public-projection.ts";
import { callCreatorProfileDoor, callCreatorVisualDoor } from "./repository.ts";

/** The bucket of the account full: committed with its line, answered after the COMMIT (modele §2). */
export type CreatorProfileRefusal = {
  state: "rate_limited";
  retryAfterSeconds: number;
};

/** The answer of search.open_creator_profile() (0323 §3.3). */
const doorAnswerSchema = z.discriminatedUnion("state", [
  z.strictObject({ state: z.literal("closed") }),
  z.strictObject({ state: z.literal("brand_not_published") }),
  z.strictObject({
    state: z.literal("rate_limited"),
    retryAfterSeconds: z.number().int().min(1),
  }),
  z.strictObject({
    state: z.literal("profile"),
    creator: z.unknown(),
    residenceRegion: z.string().nullable(),
    reasons: z.array(creatorSearchReasonSchema).min(2).max(4),
    vigilance: creatorSearchVigilanceSchema.nullable(),
  }),
]);

/** GET …/profiles/:alias: a state, the profile, or the refusal the base journaled. */
export async function openCreatorProfile(
  tx: Transaction,
  alias: string,
): Promise<CreatorSearchProfileResponse | CreatorProfileRefusal> {
  const answer = doorAnswerSchema.parse(
    await callCreatorProfileDoor(tx, alias),
  );
  switch (answer.state) {
    case "rate_limited":
      return answer;
    case "profile":
      return creatorSearchProfileResponseSchema.parse({
        state: "profile",
        creator: searchCardProjectionOf(answer.creator),
        residenceRegion: answer.residenceRegion,
        reasons: answer.reasons,
        vigilance: answer.vigilance,
      });
    default:
      return creatorSearchProfileResponseSchema.parse({ state: answer.state });
  }
}

/** Whether an answer is a refusal of the base rather than what the route serves. */
export function isCreatorProfileRefusal(
  value: CreatorSearchProfileResponse | CreatorProfileRefusal,
): value is CreatorProfileRefusal {
  return value.state === "rate_limited";
}

export type CreatorVisualLogger = {
  error(object: object, message: string): void;
};

export type CreatorVisualDependencies = {
  inTransaction: InMemberTransaction;
  store: ObjectStore;
  log: CreatorVisualLogger;
};

/**
 * GET …/visuals/:visualId (modele §3): the approved visual the door names, relayed from Storage as
 * JSON. No row (caller refused, profile not published, switch closed, alias not listed, visual
 * unknown, not approved or of another): the answer of a route that does not exist; Storage
 * unavailable: 503; the object gone: 404. Neither journal nor bucket of the account (modele §3).
 */
export async function readCreatorVisual(
  dependencies: CreatorVisualDependencies,
  alias: string,
  visualId: string,
): Promise<CreatorSearchVisualResponse> {
  const { inTransaction, store, log } = dependencies;
  const object = await inTransaction((tx) =>
    callCreatorVisualDoor(tx, alias, visualId),
  );
  if (object === null) {
    throw new ApiError("not_found");
  }
  // the object, by the key of the base: never named by the client, never in an answer nor a log
  const read = await store.read(PORTFOLIO_BUCKET, object.objectKey);
  if (!read.ok) {
    log.error(
      { reason: read.reason, status: read.status, errorCode: read.errorCode },
      "search.creator_visual.read_failed",
    );
    throw new ApiError("service_unavailable");
  }
  if (read.value === null) {
    // a row without its object: never a broken image; a person looks (D60 error line)
    log.error({}, "search.creator_visual.object_missing");
    throw new ApiError("not_found");
  }
  return portfolioImageOf(read.value, object);
}
