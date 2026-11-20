// Contract of the brand's private shortlists (docs/mvp/10 RG1, RG4, RG8, RG48, RG50, RG51, RG63, RG65;
// CA6, CA49, CA52, CA59, CA64; D38, D45, D78; jalons/l3f/modele.md §5, §8, which prevails for every name).
// Shared by apps/api and apps/web. Eight routes, for a brand alone, through the doors of 0324:
// - GET, POST /v1/me/shortlists                 list the lists, create one;
// - GET, PUT, DELETE /v1/me/shortlists/:id      read one with its creators, rename or re-attach it,
//                                               delete it;
// - PUT, DELETE /v1/me/shortlists/:id/items/:alias        add a creator, remove it;
// - PUT /v1/me/shortlists/:id/items/:alias/note           note a creator, or clear the note.
// A creator is referenced by its ALIAS only (RG65), a list by its opaque uuid: no account identifier,
// no sequential number, no handle, URL, exact figure, share, completeness, state, refused sector,
// price, rate, currency nor net exists in an answer, not even empty (fiche invariants 1, 2, 11). A card
// is the card of the search, whole (`creatorProjectionBeforeSchema`, built by the one module of
// apps/api). There is NO export, NO « add them all » and NO size of page: a list holds at most
// `itemsPerList` creators, in the base (RG63, TM12.3). The door answers a state alone when the switch is
// closed (D38) or the brand's profile is not published (RG1): nothing written, nothing served. A list of
// another brand, unknown, a campaign not admitted or a creator unknown, excluded or never served: the
// answer of a route that does not exist (404, CA49); a name, a note or a message refused: 400
// `validation_failed` on its path; a bound reached: 409 `conflict` (`shortlist_limit`, `shortlist_full`).
import { z } from "./zod.ts";
import { creatorProjectionBeforeSchema } from "./creator-projection.ts";

/** The alias of the path, as the client gives it: checked by the door alone (CA49). */
const pathAliasSchema = z.string().min(1).max(64);

/** The issues of a 409 `conflict`, on the path `shortlist` (modele §5). */
export const SHORTLIST_LIMIT_ISSUE = "shortlist_limit";
export const SHORTLIST_FULL_ISSUE = "shortlist_full";

/** The issues of a 400 `validation_failed` the base raised (22023 DETAIL name, note). */
export const SHORTLIST_NAME_ISSUE = "invalid_name";
export const SHORTLIST_NOTE_ISSUE = "invalid_note";

/** …/shortlists/:id: the opaque identifier of a list. */
export const shortlistParamsSchema = z.strictObject({ id: z.uuid() });
export type ShortlistParams = z.infer<typeof shortlistParamsSchema>;

/** …/shortlists/:id/items/:alias: a list and the alias of a creator of a card the brand was served. */
export const shortlistItemParamsSchema = z.strictObject({
  id: z.uuid(),
  alias: pathAliasSchema,
});
export type ShortlistItemParams = z.infer<typeof shortlistItemParamsSchema>;

/**
 * The name of a list: the base trims it and holds 1 to 80 characters on one line (22023 otherwise);
 * the bound here only keeps a body small.
 */
const shortlistNameSchema = z.string().min(1).max(200);

/** POST /v1/me/shortlists: a name and, if any, one of the brand's own campaigns (RG51). */
export const shortlistCreateBodySchema = z.strictObject({
  name: shortlistNameSchema,
  campaignId: z.uuid().nullable().default(null),
});
export type ShortlistCreateBody = z.infer<typeof shortlistCreateBodySchema>;

/** PUT /v1/me/shortlists/:id: a REPLACEMENT, `campaignId` null detaches the list from its campaign. */
export const shortlistUpdateBodySchema = z.strictObject({
  name: shortlistNameSchema,
  campaignId: z.uuid().nullable(),
});
export type ShortlistUpdateBody = z.infer<typeof shortlistUpdateBodySchema>;

/**
 * PUT …/items/:alias/note: 1 to 500 characters once trimmed (the base decides), null clears the note.
 * The note is the brand's own, read by nobody else.
 */
export const shortlistNoteBodySchema = z.strictObject({
  note: z.string().min(1).max(2000).nullable(),
});
export type ShortlistNoteBody = z.infer<typeof shortlistNoteBodySchema>;

/** A list as the brand sees it: `count` is the creators the engine lists today, the hidden ones not counted. */
export const shortlistSummarySchema = z.strictObject({
  id: z.uuid(),
  name: z.string().min(1).max(80),
  campaignId: z.uuid().nullable(),
  count: z.number().int().min(0),
  createdAt: z.iso.datetime(),
});
export type ShortlistSummary = z.infer<typeof shortlistSummarySchema>;

/** A creator of a list: its card, whole (CA6), the brand's own note, the date of the addition. */
export const shortlistItemSchema = z.strictObject({
  creator: creatorProjectionBeforeSchema,
  note: z.string().min(1).max(500).nullable(),
  addedAt: z.iso.datetime(),
});
export type ShortlistItem = z.infer<typeof shortlistItemSchema>;

const closedSchema = z.strictObject({ state: z.literal("closed") });
const brandNotPublishedSchema = z.strictObject({
  state: z.literal("brand_not_published"),
});

/** GET /v1/me/shortlists, 200: a state alone (D38, RG1), or the lists, newest first. */
export const shortlistsResponseSchema = z.discriminatedUnion("state", [
  closedSchema,
  brandNotPublishedSchema,
  z.strictObject({
    state: z.literal("shortlists"),
    shortlists: z.array(shortlistSummarySchema),
  }),
]);
export type ShortlistsResponse = z.infer<typeof shortlistsResponseSchema>;

/** POST /v1/me/shortlists and PUT /v1/me/shortlists/:id, 200: the list as it now is. */
export const shortlistResponseSchema = z.discriminatedUnion("state", [
  closedSchema,
  brandNotPublishedSchema,
  z.strictObject({
    state: z.literal("shortlist"),
    shortlist: shortlistSummarySchema,
  }),
]);
export type ShortlistResponse = z.infer<typeof shortlistResponseSchema>;

/** GET /v1/me/shortlists/:id, 200: the list and its visible creators, newest first. */
export const shortlistReadResponseSchema = z.discriminatedUnion("state", [
  closedSchema,
  brandNotPublishedSchema,
  z.strictObject({
    state: z.literal("shortlist"),
    shortlist: shortlistSummarySchema,
    items: z.array(shortlistItemSchema),
  }),
]);
export type ShortlistReadResponse = z.infer<typeof shortlistReadResponseSchema>;

/** DELETE /v1/me/shortlists/:id, 200. */
export const shortlistDeleteResponseSchema = z.discriminatedUnion("state", [
  closedSchema,
  brandNotPublishedSchema,
  z.strictObject({ state: z.literal("deleted") }),
]);
export type ShortlistDeleteResponse = z.infer<
  typeof shortlistDeleteResponseSchema
>;

/** PUT …/items/:alias, 200: idempotent. */
export const shortlistAddResponseSchema = z.discriminatedUnion("state", [
  closedSchema,
  brandNotPublishedSchema,
  z.strictObject({ state: z.literal("added") }),
]);
export type ShortlistAddResponse = z.infer<typeof shortlistAddResponseSchema>;

/** PUT …/items/:alias/note, 200. */
export const shortlistNoteResponseSchema = z.discriminatedUnion("state", [
  closedSchema,
  brandNotPublishedSchema,
  z.strictObject({ state: z.literal("noted") }),
]);
export type ShortlistNoteResponse = z.infer<typeof shortlistNoteResponseSchema>;

/** DELETE …/items/:alias, 200: idempotent, the same answer whether the creator was there or not. */
export const shortlistRemoveResponseSchema = z.discriminatedUnion("state", [
  closedSchema,
  brandNotPublishedSchema,
  z.strictObject({ state: z.literal("removed") }),
]);
export type ShortlistRemoveResponse = z.infer<
  typeof shortlistRemoveResponseSchema
>;
