// SQL of the public projection of a creator (../public-projection.ts, the one module that builds it;
// docs/mvp/07 RG102, RG104; jalons/l2g/modele.md point 9). Two reads, with the rights of the caller:
// - `readProjectionLayerA`: profiles.creator_layer_a() (0319, jalons/l3e/modele.md §2), THE source of
//   layer A, shared with the brand's creator search door so that the preview is exactly what a brand
//   is served (RG104): the layer-A tables alone (the storefront, its lists, creator_public_networks,
//   creator_public_audience, the approved visuals, the level and date of the badges of the projected
//   lines); never creator_social_accounts, creator_identities nor identity.accounts. The key of a
//   line comes out to tie its layer I, never further than the module.
// - `readProjectionLayerI`: the layer I of the lines of the account (creator_social_accounts and the
//   exact audience of the main line), for the creator's own "after" tab.
import type {
  CreatorProjectionAudienceBand,
  CreatorProjectionAudienceShare,
  CreatorProjectionBefore,
  CreatorProjectionNetwork,
} from "@influx/contracts/creator-projection";
import { sql } from "drizzle-orm";
import type { Transaction } from "../../../../db/index.ts";

/** A projected line, with the key that ties its layer I: kept inside apps/api, never served. */
export type ProjectedLineRow = CreatorProjectionNetwork & { lineKey: string };

/** Layer A as the database holds it; the visuals approved, in the creator's order. */
export type ProjectionLayerARow = {
  status: string;
  alias: string;
  headline: string | null;
  bio: string | null;
  primary_topic: string | null;
  residence_country: CreatorProjectionBefore["residenceCountry"];
  travel_scope: CreatorProjectionBefore["travelScope"];
  collaboration_experience: CreatorProjectionBefore["collaborationExperience"];
  main_audience_country: CreatorProjectionBefore["mainAudienceCountry"];
  main_audience_share_band: string | null;
  audience_gender_band: string | null;
  delivery_lead: CreatorProjectionBefore["deliveryLead"];
  max_exclusivity: CreatorProjectionBefore["maxExclusivity"];
  accepts_non_monetary: boolean;
  availability: CreatorProjectionBefore["availability"];
  secondary_topics: string[];
  tones: string[];
  publication_languages: string[];
  formats: string[];
  usage_rights: CreatorProjectionBefore["usageRights"];
  audience_bands: CreatorProjectionAudienceBand[];
  lines: ProjectedLineRow[];
  visuals: { id: string; caption: string | null }[];
};

/**
 * Layer A of `accountId`, or null when it holds no storefront (or the caller may not read it). A line
 * is projected once LISTED; a profile never published projects every line, as its publication would
 * list them all (0244). The badges: « Compte vérifié » and « Audience vérifiée » while they hold
 * (active, to_refresh).
 */
export async function readProjectionLayerA(
  tx: Transaction,
  accountId: string,
): Promise<ProjectionLayerARow | null> {
  const rows = await tx.execute<{ layer: ProjectionLayerARow | null }>(sql`
    select profiles.creator_layer_a(${accountId}::uuid) as layer`);
  return rows[0]?.layer ?? null;
}

/** The layer I of a line, and the exact audience of the main one (null on another line). */
export type ProjectionLayerIRow = {
  lineKey: string;
  handle: string | null;
  profileUrl: string | null;
  followersCount: number | null;
  postsLast30Days: number | null;
  avgCommentsPerPost: number | null;
  avgReachPerPost: number | null;
  shares: CreatorProjectionAudienceShare[] | null;
};

/** Every line of `accountId` with its layer I, as JSON (the pool returns a bigint as text). */
export async function readProjectionLayerI(
  tx: Transaction,
  accountId: string,
): Promise<ProjectionLayerIRow[]> {
  const rows = await tx.execute<{ line: ProjectionLayerIRow }>(sql`
    select jsonb_build_object(
             'lineKey', n.id::text,
             'handle', n.handle,
             'profileUrl', n.profile_url,
             'followersCount', n.followers_count,
             'postsLast30Days', n.posts_last_30_days,
             'avgCommentsPerPost', n.avg_comments_per_post,
             'avgReachPerPost', n.avg_reach_per_post,
             'shares', case when n.is_primary then
                 coalesce((select jsonb_agg(jsonb_build_object(
                              'dimension', 'country', 'code', c.country_code::text,
                              'share', c.share_percent) order by c.slot)
                             from profiles.creator_audience_countries c
                            where c.social_account_id = n.id and c.share_percent is not null),
                          '[]'::jsonb)
                 || coalesce((select jsonb_agg(jsonb_build_object(
                                 'dimension', 'age', 'code', g.age_band_code::text,
                                 'share', g.share_percent) order by g.age_band_code)
                                from profiles.creator_audience_ages g
                               where g.social_account_id = n.id), '[]'::jsonb)
                 || coalesce((select jsonb_agg(jsonb_build_object(
                                 'dimension', 'gender', 'code', x.gender_code::text,
                                 'share', x.share_percent) order by x.gender_code)
                                from profiles.creator_audience_genders x
                               where x.social_account_id = n.id), '[]'::jsonb)
               end) as line
      from profiles.creator_social_accounts n
     where n.account_id = ${accountId}::uuid`);
  return rows.map((row) => row.line);
}
