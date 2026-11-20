// The brand's shortlists, from the answer of the doors of the base to the strict contract (docs/mvp/10
// RG4, RG48, RG50, RG51, RG63, RG65; CA6, CA49, CA52; jalons/l3f/modele.md §5, §8; fiche invariants 1, 2,
// 6, 7). Nothing is read here but what a door returned, and its answer is checked WHOLE and strict
// before anything is chosen from it:
// - the answers without a card are the contract's own schemas, parsed as the door gave them;
// - the creator of an item is profiles.creator_layer_a() as search.anonymous_card() serves it (no
//   status, no key of a line), shaped by THE public projection (profiles/creator/public-projection.ts),
//   exactly as a card of the search: never built here (CA6);
// - a door's answer of another shape fails here (a 500), rather than reach a brand: an account
//   identifier, a sequential number or a key of RG48 has no place in a schema of the contract.
import {
  shortlistAddResponseSchema,
  shortlistDeleteResponseSchema,
  shortlistItemSchema,
  shortlistNoteResponseSchema,
  shortlistReadResponseSchema,
  shortlistRemoveResponseSchema,
  shortlistResponseSchema,
  shortlistsResponseSchema,
  shortlistSummarySchema,
  type ShortlistAddResponse,
  type ShortlistDeleteResponse,
  type ShortlistNoteResponse,
  type ShortlistReadResponse,
  type ShortlistRemoveResponse,
  type ShortlistResponse,
  type ShortlistsResponse,
} from "@influx/contracts/shortlists";
import * as z from "zod";
import type { Transaction } from "../../../db/index.ts";
import { searchCardProjectionOf } from "../../profiles/creator/public-projection.ts";
import {
  callAddToShortlist,
  callCreateShortlist,
  callDeleteShortlist,
  callListShortlists,
  callReadShortlist,
  callRemoveFromShortlist,
  callSetShortlistNote,
  callUpdateShortlist,
} from "./repository.ts";

/** search.read_shortlist() (0324 §3.7): the list and its visible creators, each card as the door built it. */
const doorReadAnswerSchema = z.discriminatedUnion("state", [
  z.strictObject({ state: z.literal("closed") }),
  z.strictObject({ state: z.literal("brand_not_published") }),
  z.strictObject({
    state: z.literal("shortlist"),
    shortlist: shortlistSummarySchema,
    items: z.array(
      z.strictObject({
        creator: z.unknown(),
        note: shortlistItemSchema.shape.note,
        addedAt: shortlistItemSchema.shape.addedAt,
      }),
    ),
  }),
]);

/** GET /v1/me/shortlists. */
export async function listShortlists(
  tx: Transaction,
): Promise<ShortlistsResponse> {
  return shortlistsResponseSchema.parse(await callListShortlists(tx));
}

/** GET /v1/me/shortlists/:id. */
export async function readShortlist(
  tx: Transaction,
  shortlistId: string,
): Promise<ShortlistReadResponse> {
  const answer = doorReadAnswerSchema.parse(
    await callReadShortlist(tx, shortlistId),
  );
  if (answer.state !== "shortlist") {
    return shortlistReadResponseSchema.parse({ state: answer.state });
  }
  return shortlistReadResponseSchema.parse({
    state: "shortlist",
    shortlist: answer.shortlist,
    items: answer.items.map((item) => ({
      creator: searchCardProjectionOf(item.creator),
      note: item.note,
      addedAt: item.addedAt,
    })),
  });
}

/** POST /v1/me/shortlists. */
export async function createShortlist(
  tx: Transaction,
  name: string,
  campaignId: string | null,
): Promise<ShortlistResponse> {
  return shortlistResponseSchema.parse(
    await callCreateShortlist(tx, name, campaignId),
  );
}

/** PUT /v1/me/shortlists/:id. */
export async function updateShortlist(
  tx: Transaction,
  shortlistId: string,
  name: string,
  campaignId: string | null,
): Promise<ShortlistResponse> {
  return shortlistResponseSchema.parse(
    await callUpdateShortlist(tx, shortlistId, name, campaignId),
  );
}

/** DELETE /v1/me/shortlists/:id. */
export async function deleteShortlist(
  tx: Transaction,
  shortlistId: string,
): Promise<ShortlistDeleteResponse> {
  return shortlistDeleteResponseSchema.parse(
    await callDeleteShortlist(tx, shortlistId),
  );
}

/** PUT /v1/me/shortlists/:id/items/:alias. */
export async function addToShortlist(
  tx: Transaction,
  shortlistId: string,
  alias: string,
): Promise<ShortlistAddResponse> {
  return shortlistAddResponseSchema.parse(
    await callAddToShortlist(tx, shortlistId, alias),
  );
}

/** PUT /v1/me/shortlists/:id/items/:alias/note. */
export async function setShortlistNote(
  tx: Transaction,
  shortlistId: string,
  alias: string,
  note: string | null,
): Promise<ShortlistNoteResponse> {
  return shortlistNoteResponseSchema.parse(
    await callSetShortlistNote(tx, shortlistId, alias, note),
  );
}

/** DELETE /v1/me/shortlists/:id/items/:alias. */
export async function removeFromShortlist(
  tx: Transaction,
  shortlistId: string,
  alias: string,
): Promise<ShortlistRemoveResponse> {
  return shortlistRemoveResponseSchema.parse(
    await callRemoveFromShortlist(tx, shortlistId, alias),
  );
}
