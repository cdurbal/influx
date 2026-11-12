// What the journeys of the portfolio and of the publication of a creator (docs/mvp/07 RG4 to RG10,
// RG77 to RG84; jalons/l2g, commit 13) start from and read back, written straight into the local
// stack by the migration role as apps/api's own tests write them: a creator holding every required
// field but the portfolio, an active « Compte vérifié » granted by an agent (08 RG16, a missing
// badge keeps the profile from being submitted), the decision of an agent (a refusal, a
// publication) as the database leaves it, and what the database holds of the visuals. The decisions
// themselves belong to the backoffice screens of the next commits: here they are only their outcome.
// Nothing here is an amount, a rate or a price (D78).
import { expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { WEB_ORIGIN } from "./servers";
import { EVIDENCE_FIXTURE, grantAsAgent } from "./verification";
import { withSql } from "./verification-cycle";

/** What the browser adds to a same-origin call, and the API checks (03 PP-5). */
const HEADERS = {
  origin: WEB_ORIGIN,
  "sec-fetch-site": "same-origin",
} as const;
const PROFILE_URL = `${WEB_ORIGIN}/api/v1/me/creator-profile`;

export const HEADLINE = "Créatrice de tutoriels cuisine végétale du quotidien";
export const BIO = `${"Je partage des recettes simples, de saison, pensées pour les familles pressées. ".repeat(2)}Chaque semaine, une vidéo et une fiche pratique.`;
export const NEW_HEADLINE = "Cuisine végétale, recettes de saison et astuces";

/**
 * A creator holding every required field but the portfolio: blocks 1, 2 and 5 saved by the API as the
 * autosave does, the main line with its address, its dated figures and its main audience country,
 * and an active « Compte vérifié » granted by `agentId`. The browser context carries the creator's
 * session (`seedMember` set it).
 */
export async function seedCreatorWithoutPortfolio(
  page: Page,
  accountId: string,
  agentId: string,
): Promise<void> {
  const saved = await page.request.patch(PROFILE_URL, {
    headers: HEADERS,
    data: {
      headline: HEADLINE,
      bio: BIO,
      primaryTopic: "food",
      publicationLanguages: ["fr"],
      formats: ["instagram_reel", "ugc_video"],
      availability: "lt_1m",
    },
  });
  expect(saved.ok()).toBe(true);
  await withSql(async (sql) => {
    const [line] = await sql<{ id: string }[]>`
      insert into profiles.creator_social_accounts
        (account_id, network_code, is_primary, handle, profile_url, followers_count,
         posts_last_30_days, avg_comments_per_post, figures_measured_at)
      values (${accountId}, 'instagram', true, ${`l2g_${accountId.slice(0, 8)}`},
              ${`https://www.instagram.com/l2g_${accountId.slice(0, 8)}`}, 48000, 12, 30, now())
      returning id::text`;
    await sql`
      insert into profiles.creator_audience_countries
        (social_account_id, account_id, slot, country_code, share_percent)
      values (${line?.id ?? ""}, ${accountId}, 0, 'FR', 70)`;
  });
  await grantAsAgent(accountId, agentId);
}

/** The stored state of the profile and of its queue-2 entries, as the screens' calls left it. */
export async function profileFacts(accountId: string): Promise<{
  status: string;
  searchable: boolean;
  entries: { kind: string; state: string }[];
}> {
  return withSql(async (sql) => {
    const [profile] = await sql<{ status: string; searchable: boolean }[]>`
      select status::text as status, is_searchable as searchable
        from profiles.creator_public_profiles where account_id = ${accountId}`;
    const entries = await sql<{ kind: string; state: string }[]>`
      select kind::text, state::text from profiles.creator_review_entries
       where account_id = ${accountId} order by created_at, id`;
    return {
      status: profile?.status ?? "missing",
      searchable: profile?.searchable ?? false,
      entries: [...entries],
    };
  });
}

/** The visuals of the creator in the creator's order, with their caption and the declaration kept for it. */
export async function visualsOf(accountId: string): Promise<
  {
    id: string;
    state: string;
    order: number | null;
    caption: string | null;
    exifStripped: boolean;
    declarations: number;
  }[]
> {
  return withSql(
    (sql) => sql`
      select i.id::text, i.state::text as state, i.display_order::int as "order", i.caption,
             i.exif_stripped as "exifStripped",
             (select count(*)::int from profiles.portfolio_brand_declarations d
               where d.portfolio_item_id = i.id) as declarations
        from profiles.portfolio_items i
       where i.account_id = ${accountId}
       order by i.display_order nulls last, i.created_at, i.id`,
  );
}

/** The refusal of the open entry as an agent's decision leaves it (0244): the reason of the closed list, the profile refused. */
export async function refuseProfileAsAgent(
  accountId: string,
  agentId: string,
  reason: string,
): Promise<void> {
  await withSql(async (sql) => {
    await sql`
      update profiles.creator_review_entries
         set state = 'rejected', decided_by_account_id = ${agentId}, decided_at = now(),
             rejection_reason_code = ${reason}, internal_comment = 'INTERNAL-NOTE-L2G-13', closed_at = now()
       where account_id = ${accountId} and state = 'open'`;
    await sql`
      update profiles.creator_public_profiles set status = 'rejected'
       where account_id = ${accountId}`;
  });
}

/** The publication as an agent's decision leaves it: published for the first time, the main line listed. */
export async function publishProfileAsAgent(
  accountId: string,
  agentId: string,
): Promise<void> {
  await withSql(async (sql) => {
    await sql`
      update profiles.creator_review_entries
         set state = 'published', decided_by_account_id = ${agentId}, decided_at = now(),
             internal_comment = 'INTERNAL-NOTE-L2G-13', closed_at = now()
       where account_id = ${accountId} and state = 'open'`;
    await sql`
      update profiles.creator_public_profiles set status = 'published', published_at = now()
       where account_id = ${accountId}`;
    await sql`
      update profiles.creator_public_networks set listed_at = now()
       where account_id = ${accountId}`;
  });
}

/** A change of the headline of a published profile, sent as the autosave sends it: it waits for a decision (RG9, CA48). */
export async function changeHeadline(page: Page): Promise<void> {
  const changed = await page.request.patch(PROFILE_URL, {
    headers: HEADERS,
    data: { headline: NEW_HEADLINE },
  });
  expect(changed.ok()).toBe(true);
}

/** Visuals deposited through the API's own door, as the screen's deposit does: the state a case needs BEFORE the gesture it tests. */
export async function depositVisuals(page: Page, count: number): Promise<void> {
  const bytes = readFileSync(EVIDENCE_FIXTURE);
  for (let deposited = 0; deposited < count; deposited += 1) {
    const sent = await page.request.put(`${PROFILE_URL}/portfolio`, {
      headers: { ...HEADERS, "content-type": "application/octet-stream" },
      data: bytes,
    });
    expect(sent.ok()).toBe(true);
  }
}
