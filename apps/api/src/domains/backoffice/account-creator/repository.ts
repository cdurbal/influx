// Database access of blocks 2 to 4 of a creator record (docs/mvp/07 RG71, RG4, RG88; 17b §3.6; jalons/l2g/
// modele.md §1 point 13; L2G-17), under influx_agent or influx_admin in aal2 (the internal SELECT policies of
// 0217 and 0242).
// - The EXACT figures of each network line, with their date and their source (10 RG71: never a band in place
//   of a figure): those the holding audience badge observed (active, to_refresh), dated by its grant, else
//   those the creator declared, dated by their measure (`EXACT_FIGURES_JOINS` below, shared with queue 2;
//   modele point 9, 08 RG19, RG20). No handle, no address, no pseudonym, no band, no audience share.
// - The portfolio as two counts. Never a caption, a file name, a checksum nor an object key (D82 (7)).
// - No line of the register is written by this read: the record is opened through
//   backoffice.read_subject_history() (0132), which writes `history.account_read` once for the whole record
//   (15 RG40). The caller reads this BEFORE the history, in the same transaction, as the brand blocks.
// Parameterised queries only (S-1).
import type { Transaction } from "../../../db/index.ts";
import { sql } from "drizzle-orm";
import { ISO_UTC } from "../sql-formats.ts";

// The exact figures of a network line, with their date and their source: ONE rule, shared by the creator
// record (this file's `creatorRecordOf`) and the decision screen of queue 2 (creator-queues/views/repository.ts)
// so that the two never tell an agent two different audiences (jalons/l2g/modele.md §1 point 9; 08 RG19, RG20).
// - The figures an agent observed on the dashboard, held by the line's audience badge in force (`active`,
//   `to_refresh`; a tenant badge is the only badge that carries figures), dated by its grant, source
//   `agent_observed`;
// - else the figures the creator declared, dated by their measure, source `declared` (0225: the declared side of
//   a line never carries an observed value).
// The average reach has no observed counterpart on a badge: it is served only with the declared figures, so a
// line never mixes a declared reach with observed figures under an « observed » source.
// Query side: the caller selects from `profiles.creator_social_accounts n` and appends this fragment to its
// joins; it then reads `f.followers`, `f.posts`, `f.comments`, `f.engagement`, `f.reach`, `f.measured_at`,
// `f.source`. No parameter, no layer N.
export const EXACT_FIGURES_JOINS = sql`
      left join lateral (
        select o.granted_at, o.observed_followers, o.observed_posts_last_30_days,
               o.observed_avg_comments, o.observed_engagement_bp
          from verification.badges o
         where o.account_id = n.account_id and o.social_account_id = n.id
           and o.level = 'audience_verified' and o.state in ('active', 'to_refresh')
         order by o.granted_at desc
         limit 1) h on true
      cross join lateral (
        select case when h.granted_at is null then n.followers_count
                    else h.observed_followers end as followers,
               case when h.granted_at is null then n.posts_last_30_days
                    else h.observed_posts_last_30_days end as posts,
               case when h.granted_at is null then n.avg_comments_per_post
                    else h.observed_avg_comments end as comments,
               case when h.granted_at is null then n.engagement_rate_bp
                    else h.observed_engagement_bp end as engagement,
               case when h.granted_at is null then n.avg_reach_per_post
                    else null end as reach,
               case when h.granted_at is null then n.figures_measured_at
                    else h.granted_at end as measured_at,
               case when h.granted_at is null then 'declared'
                    else 'agent_observed' end as source) f`;

export type CreatorRecord = {
  networks: {
    id: string;
    networkCode: string;
    isPrimary: boolean;
    awaitingValidation: boolean;
    followers: number | null;
    postsLast30Days: number | null;
    avgComments: number | null;
    engagementRateBp: number | null;
    measuredAt: string | null;
    source: "declared" | "agent_observed";
  }[];
  portfolio: { deposited: number; pending: number };
};

/** The creator blocks of a creator account; empty values for a profile never started, never an error. */
export async function creatorRecordOf(
  tx: Transaction,
  accountId: string,
): Promise<CreatorRecord> {
  const lines = await tx.execute<{
    id: string;
    network_code: string;
    is_primary: boolean;
    awaiting_validation: boolean;
    followers: number | null;
    posts: number | null;
    comments: number | null;
    engagement: number | null;
    measured_at: string | null;
    source: "declared" | "agent_observed";
  }>(sql`
    select n.id::text as id, n.network_code::text as network_code, n.is_primary,
           -- modele point 6: a line waits for a decision only on a profile already published; before the
           -- first publication every line waits with the whole profile (queue 2), which is no news
           (c.listed_at is null and p.published_at is not null) as awaiting_validation,
           f.followers::float8 as followers, f.posts::float8 as posts,
           f.comments::float8 as comments, f.engagement::float8 as engagement,
           to_char(f.measured_at at time zone 'UTC', ${ISO_UTC}) as measured_at, f.source
      from profiles.creator_social_accounts n
      join profiles.creator_public_profiles p on p.account_id = n.account_id
      left join profiles.creator_public_networks c on c.social_account_id = n.id
      ${EXACT_FIGURES_JOINS}
     where n.account_id = ${accountId}::uuid
     order by n.is_primary desc, n.network_code, n.id`);
  const [counts] = await tx.execute<{ deposited: number; pending: number }>(sql`
    select count(*) filter (
             where v.state in ('pending', 'approved')
               -- 07 RG4, RG88: a pending replacement shares the place of its approved original
               and not (v.state = 'pending'
                        and exists (select 1 from profiles.portfolio_items o
                                     where o.id = v.replaces_item_id and o.state = 'approved'))
           )::int as deposited,
           count(*) filter (where v.state = 'pending')::int as pending
      from profiles.portfolio_items v
     where v.account_id = ${accountId}::uuid`);
  return {
    networks: lines.map((line) => ({
      id: line.id,
      networkCode: line.network_code,
      isPrimary: line.is_primary,
      awaitingValidation: line.awaiting_validation,
      followers: line.followers,
      postsLast30Days: line.posts,
      avgComments: line.comments,
      engagementRateBp: line.engagement,
      measuredAt: line.measured_at,
      source: line.source,
    })),
    portfolio: {
      deposited: counts?.deposited ?? 0,
      pending: counts?.pending ?? 0,
    },
  };
}
