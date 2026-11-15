// The campaigns the journeys of queue 7 find waiting (L3C-08; docs/mvp/09 RG4, RG5, RG85): a brand with a
// published profile, its campaign written and submitted through the API's own routes as the member's session
// does (the screens of the brand are not under test here), then read back from the base after the agent's
// decision. The brand is given to a colleague, so that a journey reads its own entries alone, by `?owner=`
// (15 RG36), whatever other journeys left in the queue. Dates are derived from the UTC day of the run (L3C-01).
import type { Page } from "@playwright/test";
import { seedMember } from "./account";
import { campaignCalendar } from "./campaign-calendar";
import { expect } from "./journey";
import { WEB_ORIGIN } from "./servers";
import { withSql } from "./verification-cycle";

/** What a page's own script sends, which a request of the test runner does not (03 §6.4 A4). */
const SAME_ORIGIN = { origin: WEB_ORIGIN, "sec-fetch-site": "same-origin" };

const SUMMARY =
  "Nous cherchons des créateurs de contenu beauté pour tester notre nouvelle gamme de soins du visage sur Instagram, avec des contenus sincères, courts et soignés.";
const BRIEF =
  "Notre gamme de soins du visage sort en janvier. Nous voulons des vidéos courtes où le créateur essaie les produits pendant une semaine, raconte ce qu'il observe, montre sa routine du matin et du soir, et donne un avis honnête. Le ton est chaleureux, sans promesse excessive. Les produits restent libres de mise en scène, le créateur choisit son décor et son angle, tant que les gestes d'application sont visibles et que le nom de la gamme est cité une fois.";

export type SubmittedCampaign = {
  accountId: string;
  campaignId: string;
  entryId: string;
  title: string;
  brandName: string;
};

/** A whole campaign, budget and calendar included, as the form would have saved it (the band, no amount: D78). */
function wholeCampaign(
  title: string,
  options: { sensitive: boolean; brief: string },
): Record<string, unknown> {
  return {
    title,
    campaignType: "product_review",
    publicSummary: SUMMARY,
    brief: options.brief,
    productDescription:
      "Une gamme de trois soins du visage naturels, testés dermatologiquement.",
    productSector: options.sensitive ? "alcohol" : "beauty_personal_care",
    productIsSent: true,
    currency: "EUR",
    productValueBand: "100_250",
    creatorKeepsProduct: true,
    shippingCostsBorneBy: "brand",
    deliverables: [
      { networkCode: "instagram", formatCode: "instagram_reel", quantity: 2 },
    ],
    usageRights: "organic_repost",
    usageRightsDuration: "3m",
    usageRightsTerritoryScope: "worldwide",
    exclusivity: "le_1m",
    contentReviewDelay: "5bd",
    audienceCountries: ["FR"],
    audienceLanguages: ["fr"],
    audienceTopics: ["beauty"],
    remunerationKind: "cash",
    budgetBand: "1000_2500",
    creatorsWanted: 3,
    ...campaignCalendar(),
  };
}

/**
 * A brand (owned by `ownerAgentId`) whose campaign waits in queue 7: the profile published by the base (the
 * decision of its own queue is L2C's), the campaign written and submitted by the member's own API routes.
 * `sensitive` puts it in a sensitive sector, which the submission accepts with its declaration (CA56).
 */
export async function submittedCampaign(
  page: Page,
  options: {
    title: string;
    ownerAgentId: string;
    sensitive?: boolean;
    brief?: string;
  },
): Promise<SubmittedCampaign> {
  const brandName = `Maison ${options.title.slice(0, 24)}`;
  const member = await seedMember(page, {
    role: "advertiser",
    language: "fr",
    acceptTerms: true,
    sessions: ["chrome.windows"],
  });
  await withSql(async (sql) => {
    await sql`
      update profiles.advertiser_profiles
         set status = 'published', submitted_at = now(), first_published_at = now(),
             legal_name = ${brandName}
       where account_id = ${member.accountId}`;
    await sql`
      update identity.accounts set owner_agent_id = ${options.ownerAgentId}
       where id = ${member.accountId}`;
  });
  const created = await page.request.post("/api/v1/me/campaigns", {
    data: {},
    headers: SAME_ORIGIN,
  });
  expect(created.status()).toBe(200);
  const campaignId = ((await created.json()) as { id: string }).id;
  const saved = await page.request.patch(`/api/v1/me/campaigns/${campaignId}`, {
    data: wholeCampaign(options.title, {
      sensitive: options.sensitive === true,
      brief: options.brief ?? BRIEF,
    }),
    headers: SAME_ORIGIN,
  });
  expect(saved.status()).toBe(200);
  const submitted = await page.request.post(
    `/api/v1/me/campaigns/${campaignId}/submit`,
    {
      data: options.sensitive === true ? { declarationLocale: "fr" } : {},
      headers: SAME_ORIGIN,
    },
  );
  expect(submitted.status(), await submitted.text()).toBe(200);
  const entryId = await withSql(async (sql) => {
    const [row] = await sql<{ id: string }[]>`
      select id::text from campaigns.campaign_review_entries
       where campaign_id = ${campaignId} and state = 'open'`;
    return row?.id ?? "";
  });
  expect(entryId).not.toBe("");
  return {
    accountId: member.accountId,
    campaignId,
    entryId,
    title: options.title,
    brandName,
  };
}

/** A colleague holds the entry for 30 minutes, as the opening of the entry would have left it (15 C1, C2). */
export async function holdEntry(
  entryId: string,
  agentAccountId: string,
): Promise<void> {
  await withSql(async (sql) => {
    await sql`
      update campaigns.campaign_review_entries
         set claimed_by_account_id = ${agentAccountId}, claimed_at = now(),
             claim_expires_at = now() + interval '30 minutes'
       where id = ${entryId}`;
  });
}

/** The brand is suspended, as an administrator would leave it (17b §3.8 « marque suspendue »). */
export async function suspendBrand(accountId: string): Promise<void> {
  await withSql(async (sql) => {
    await sql`
      update identity.accounts set status = 'suspended', suspended_at = now()
       where id = ${accountId}`;
  });
}

/** What the decisions left on the campaign and its entries, as the base holds them. */
export async function campaignDecisionOf(campaignId: string): Promise<{
  status: string;
  ownerAgentId: string | null;
  entries: {
    state: string;
    reasonCode: string | null;
    memberMessage: string | null;
    firstOpinion: string | null;
    firstReviewedBy: string | null;
    decidedBy: string | null;
  }[];
}> {
  return withSql(async (sql) => {
    const [campaign] = await sql<{ status: string; owner: string | null }[]>`
      select status::text as status, owner_agent_id::text as owner
        from campaigns.campaigns where id = ${campaignId}`;
    const entries = await sql<
      {
        state: string;
        reasonCode: string | null;
        memberMessage: string | null;
        firstOpinion: string | null;
        firstReviewedBy: string | null;
        decidedBy: string | null;
      }[]
    >`
      select state::text as state, rejection_reason_code as "reasonCode",
             member_message as "memberMessage", first_review_opinion as "firstOpinion",
             first_reviewed_by_account_id::text as "firstReviewedBy",
             decided_by_account_id::text as "decidedBy"
        from campaigns.campaign_review_entries
       where campaign_id = ${campaignId} order by created_at`;
    return {
      status: campaign?.status ?? "",
      ownerAgentId: campaign?.owner ?? null,
      entries: [...entries],
    };
  });
}
