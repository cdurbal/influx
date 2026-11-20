// Contract of the anonymous profile a brand opens from its creator search, and of its visuals
// (docs/mvp/10 RG1, RG2, RG4, RG15, RG41, RG42, RG47, RG48, RG50, RG63 to RG66; CA6, CA14, CA15, CA48 to
// CA50, CA59; D82 (7), EC-L2G-16; jalons/l3f/modele.md §2, §3, §8, which prevails for every name). Shared
// by apps/api and apps/web. Two routes, for a brand alone, through the doors of 0323:
// - GET /v1/creator-search/profiles/:alias  search.open_creator_profile(): a state, or the profile;
// - GET /v1/creator-search/profiles/:alias/visuals/:visualId  search.read_creator_visual(): the bytes
//   of an APPROVED visual, relayed as JSON by apps/api.
// The profile is EXACTLY the card of the search (`creatorProjectionBeforeSchema`, built by the one
// module of apps/api), plus the region of residence when RG15 lets it show (null below the threshold,
// the country alone, nothing else), and its reasons and note as the search gives them (fiche invariant
// 1, CA6). No handle, URL, exact figure or share, completeness, state, refused sector, account
// identifier, `public_ref`, rank, price, rate, currency nor net exists in it, not even empty. The visual
// is a type, its sides and its bytes in base64: never a key of Storage, an address, a host nor a token
// (D82 (7), fiche invariant 3). An unknown alias, an alias the engine excludes (E1 to E6), a visual
// unknown, not approved or of another creator: the answer of a route that does not exist (CA49).
import { z } from "./zod.ts";
import { portfolioImageResponseSchema } from "./creator-portfolio.ts";
import { regionCodeSchema } from "./creator-profile.ts";
import { creatorProjectionBeforeSchema } from "./creator-projection.ts";
import {
  creatorSearchReasonSchema,
  creatorSearchVigilanceSchema,
} from "./creator-search.ts";

/**
 * The alias of the path, as the client gives it (RG65): checked by the door alone, so that a malformed
 * alias is answered as an unknown one (modele §2: one answer, CA49). The router bounds its length.
 */
const pathAliasSchema = z.string().min(1).max(64);

/** GET …/profiles/:alias: the alias of the card, the only reference of a creator a brand holds. */
export const creatorSearchProfileParamsSchema = z.strictObject({
  alias: pathAliasSchema,
});
export type CreatorSearchProfileParams = z.infer<
  typeof creatorSearchProfileParamsSchema
>;

/** GET …/profiles/:alias/visuals/:visualId: the id of a visual as the card serves it (opaque). */
export const creatorSearchVisualParamsSchema = z.strictObject({
  alias: pathAliasSchema,
  visualId: z.uuid(),
});
export type CreatorSearchVisualParams = z.infer<
  typeof creatorSearchVisualParamsSchema
>;

/**
 * GET …/profiles/:alias, 200 (modele §2): a state alone (`closed`, D38; `brand_not_published`, RG1),
 * or the profile. The bucket of the account full is 429 `rate_limited` with Retry-After (T15.2).
 */
export const creatorSearchProfileResponseSchema = z.discriminatedUnion(
  "state",
  [
    z.strictObject({ state: z.literal("closed") }),
    z.strictObject({ state: z.literal("brand_not_published") }),
    z.strictObject({
      state: z.literal("profile"),
      /** The card of the search, whole (CA6): its visuals are the approved ones, in order. */
      creator: creatorProjectionBeforeSchema,
      /** RG15, CA14, CA15: shown from `region_display_threshold` storefronts sharing it; else null. */
      residenceRegion: regionCodeSchema.nullable(),
      reasons: z.array(creatorSearchReasonSchema).min(2).max(4),
      vigilance: creatorSearchVigilanceSchema.nullable(),
    }),
  ],
);
export type CreatorSearchProfileResponse = z.infer<
  typeof creatorSearchProfileResponseSchema
>;

/** GET …/visuals/:visualId, 200: the visual relayed as JSON, as the creator's own (modele §3). */
export const creatorSearchVisualResponseSchema = portfolioImageResponseSchema;
export type CreatorSearchVisualResponse = z.infer<
  typeof creatorSearchVisualResponseSchema
>;
