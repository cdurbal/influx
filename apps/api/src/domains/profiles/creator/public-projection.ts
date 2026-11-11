// THE public projection of a creator: what a brand sees of him (docs/mvp/07 RG16, RG84, RG85, RG102 to
// RG104, CA4, CA5, CA47; 03 l. 253, 312; jalons/l2g/modele.md point 9; fiche L2G invariants 1, 12, 16).
// ONE module, the only place in apps/api that builds layer A of a creator: the preview of the creator
// (GET /v1/me/creator-profile/preview, tab "before") serves it as it is, and the search of Lot 3 calls
// `readCreatorPublicProjection()` AS IT IS, never a copy (RG104: the preview is exactly what the API
// serves). Never rebuilt in a browser. Its SQL: projection/repository.ts.
//
// Layer A (`readCreatorPublicProjection`) reads the layer-A tables alone: the storefront
// (creator_public_profiles), its lists, creator_public_networks, creator_public_audience, the APPROVED
// visuals of profiles.portfolio_items (id, order, caption) and the level and date of the badges of the
// projected lines. It never reads creator_social_accounts, creator_identities nor identity.accounts, and
// serves neither `public_ref`, `social_account_id`, an account identifier, a handle, a URL, an exact
// figure, the completeness, the status (but `published`) nor the region (RG37, Lot 3). No price, rate,
// net nor currency exists in it (D48, D78, RG103).
// - A projected line is a LISTED one (listed_at, modele point 6); a profile never published shows the
//   lines its publication would list, every one of them (0244 lists them all). EC-L2G-09-2.
// - The visuals are the approved ones in the creator's order, numbered 1 to n: the card shows the first
//   three (RG84), none: no image (CA47); a pending visual, a replacement waiting, a refused or withdrawn
//   one is never in it (TM5.5, RG81: the old approved one stays served until the new one is approved).
// - Rights, at Lot 2: the session's own account only. influx_advertiser holds no right on any of these
//   tables (fiche invariant 1, T9.6); the badges are read with the caller's rights (EC-L2G-09-1:
//   `profiles.read_creator_public_badges()` waits for its first reader that is not the owner, Lot 3).
//   Lot 3 gives the brand its reads and calls this function unchanged.
//
// The "after" tab (`readCreatorPreview`) is the same projection plus the layer I of the projected lines
// (handle, URL, exact figures) and the exact audience of the main line, read from the session of the
// creator himself (0217 owner policies); what a brand reads after an introduction is Lot 4.
import type {
  CreatorPreviewResponse,
  CreatorProjectionBefore,
  CreatorProjectionIdentifiedNetwork,
} from "@influx/contracts/creator-projection";
import type { Transaction } from "../../../db/index.ts";
import {
  readProjectionLayerA,
  readProjectionLayerI,
  type ProjectedLineRow,
} from "./projection/repository.ts";

/** Layer A of one creator, and whether a brand can see it now (07 RG5: published only). */
export type CreatorPublicProjection = {
  published: boolean;
  projection: CreatorProjectionBefore;
};

/** Layer A with its projected lines, their keys kept inside this module. */
type LayerA = CreatorPublicProjection & { lines: ProjectedLineRow[] };

/** A line as layer A serves it: its key dropped. */
function layerAOf(
  line: ProjectedLineRow,
): CreatorProjectionBefore["networks"][number] {
  const { lineKey, ...network } = line;
  void lineKey;
  return network;
}

async function readLayerA(
  tx: Transaction,
  accountId: string,
): Promise<LayerA | null> {
  const row = await readProjectionLayerA(tx, accountId);
  if (row === null) {
    return null;
  }
  return {
    published: row.status === "published",
    lines: row.lines,
    projection: {
      alias: row.alias,
      headline: row.headline,
      bio: row.bio,
      primaryTopic: row.primary_topic,
      secondaryTopics: row.secondary_topics,
      tones: row.tones,
      publicationLanguages: row.publication_languages,
      residenceCountry: row.residence_country,
      travelScope: row.travel_scope,
      collaborationExperience: row.collaboration_experience,
      mainAudienceCountry: row.main_audience_country,
      mainAudienceShareBand: row.main_audience_share_band,
      audienceGenderBand: row.audience_gender_band,
      audienceBands: row.audience_bands,
      formats: row.formats,
      usageRights: row.usage_rights,
      deliveryLead: row.delivery_lead,
      maxExclusivity: row.max_exclusivity,
      acceptsNonMonetary: row.accepts_non_monetary,
      availability: row.availability,
      networks: row.lines.map(layerAOf),
      // 1 to n among the approved ones: no gap tells a brand that a visual waits or was refused
      visuals: row.visuals.map((visual, index) => ({
        id: visual.id,
        order: index + 1,
        caption: visual.caption,
      })),
    },
  };
}

/**
 * Layer A of the creator `accountId` (07 RG102 « avant »), or null when he holds no storefront. The
 * search of Lot 3 calls this function as it is.
 */
export async function readCreatorPublicProjection(
  tx: Transaction,
  accountId: string,
): Promise<CreatorPublicProjection | null> {
  const layerA = await readLayerA(tx, accountId);
  return layerA === null
    ? null
    : { published: layerA.published, projection: layerA.projection };
}

/**
 * The two tabs of the preview of the session's own account (07 RG104): "before" is the public
 * projection as it is; "after" adds the layer I of the same lines and the exact audience of the main
 * one. Null when the account holds no storefront.
 */
export async function readCreatorPreview(
  tx: Transaction,
  accountId: string,
): Promise<CreatorPreviewResponse | null> {
  const layerA = await readLayerA(tx, accountId);
  if (layerA === null) {
    return null;
  }
  // every line of the account; only the projected ones are kept
  const layerI = new Map(
    (await readProjectionLayerI(tx, accountId)).map((line) => [
      line.lineKey,
      line,
    ]),
  );
  const networks: CreatorProjectionIdentifiedNetwork[] = layerA.lines.map(
    (projected) => {
      const network = layerAOf(projected);
      const line = layerI.get(projected.lineKey);
      // 08 RG19, RG40: an observed line shows no declared value as its exact figure (EC-L2G-09-3)
      const declared = network.figuresSource === "declared";
      return {
        ...network,
        handle: line?.handle ?? null,
        profileUrl: line?.profileUrl ?? null,
        followersCount: declared ? (line?.followersCount ?? null) : null,
        postsLast30Days: declared ? (line?.postsLast30Days ?? null) : null,
        avgCommentsPerPost: declared
          ? (line?.avgCommentsPerPost ?? null)
          : null,
        avgReachPerPost: declared ? (line?.avgReachPerPost ?? null) : null,
      };
    },
  );
  const main = layerA.lines.find((line) => line.isPrimary);
  return {
    published: layerA.published,
    before: layerA.projection,
    after: {
      ...layerA.projection,
      networks,
      audienceShares:
        main === undefined ? [] : (layerI.get(main.lineKey)?.shares ?? []),
    },
  };
}
