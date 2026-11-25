// A campaign of a brand put in each of its six states (docs/mvp/09 RG3; jalons/l3c, commit 10, L3C-E3): written
// through the API's own routes as the member's session does (the form is not under test here), then given the
// state INFLUX alone gives, straight into the local stack by the migration role, as a decision would. The decider
// is a colleague seeded by the journey. Nothing here is an amount, a rate or a price.
import type { Page } from "@playwright/test";
import { completeCampaignBody } from "./campaign-review";
import { expect } from "./journey";
import { WEB_ORIGIN } from "./servers";
import { withSql } from "./verification-cycle";

/** What a page's own script sends, which a request of the test runner does not (03 §6.4 A4). */
const SAME_ORIGIN = { origin: WEB_ORIGIN, "sec-fetch-site": "same-origin" };

export type SeededState =
  "draft" | "pending_review" | "published" | "paused" | "closed" | "rejected";

/** A refusal as queue 7 leaves it: the typed reason and, for `other` and `illicit_content`, the agent's message. */
export type SeededRefusal = { reasonCode: string; memberMessage?: string };

/** Creates the campaign through the API and returns its identifier. */
async function create(
  page: Page,
  title: string,
  complete: boolean,
  overrides: Record<string, unknown>,
): Promise<string> {
  const created = await page.request.post("/api/v1/me/campaigns", {
    data: complete
      ? { ...completeCampaignBody(title), ...overrides }
      : { title },
    headers: SAME_ORIGIN,
  });
  expect(created.status(), await created.text()).toBe(200);
  return ((await created.json()) as { id: string }).id;
}

/**
 * A campaign of the signed-in brand in `state`. `decider` is an internal account (published, refused by it);
 * `refusal` is the reason of a `rejected` one. Published, paused and closed are written as a published entry and
 * its snapshot, in ONE statement (the state needs them, 0308), the snapshot holding the real creator view and its
 * SHA-256 as the publication writes them; a `paused` one reads as INFLUX's pause (0309).
 */
export async function seedCampaignInState(
  page: Page,
  options: {
    title: string;
    state: SeededState;
    decider: string;
    refusal?: SeededRefusal;
    /** Fields of the body that replace the whole campaign's own (L3D-05: the heaviest usage rights). */
    overrides?: Record<string, unknown>;
  },
): Promise<string> {
  const { title, state, decider } = options;
  const id = await create(
    page,
    title,
    state !== "draft",
    options.overrides ?? {},
  );
  if (state === "draft") {
    return id;
  }
  if (state === "pending_review") {
    const submitted = await page.request.post(
      `/api/v1/me/campaigns/${id}/submit`,
      { data: {}, headers: SAME_ORIGIN },
    );
    expect(submitted.status(), await submitted.text()).toBe(200);
    return id;
  }
  await withSql(async (sql) => {
    if (state === "rejected") {
      const refusal = options.refusal ?? { reasonCode: "brief_insufficient" };
      await sql`
        insert into campaigns.campaign_review_entries
          (campaign_id, advertiser_account_id, state, decided_by_account_id, decided_at, closed_at,
           rejection_reason_code, member_message)
        select c.id, c.advertiser_account_id, 'rejected', ${decider}::uuid, now(), now(),
               ${refusal.reasonCode}, ${refusal.memberMessage ?? null}
          from campaigns.campaigns c where c.id = ${id}::uuid`;
      await sql`update campaigns.campaigns set status = 'rejected' where id = ${id}::uuid`;
      return;
    }
    await sql`
      with entry as (
        insert into campaigns.campaign_review_entries
          (campaign_id, advertiser_account_id, state, decided_by_account_id, decided_at, closed_at)
        select c.id, c.advertiser_account_id, 'published', ${decider}::uuid, now(), now()
          from campaigns.campaigns c where c.id = ${id}::uuid
        returning id, campaign_id),
      shown as (
        select e.id, e.campaign_id, campaigns.campaign_creator_view(e.campaign_id) as payload
          from entry e),
      snapshot as (
        insert into campaigns.campaign_published_snapshots
          (campaign_id, version, payload, content_hash, published_at, published_by_account_id,
           review_entry_id)
        select e.campaign_id, 1, e.payload, sha256(convert_to(e.payload::text, 'UTF8')), now(),
               ${decider}::uuid, e.id
          from shown e
        returning id, campaign_id)
      update campaigns.campaigns c
         set status = ${state === "paused" ? "paused" : "published"}::campaigns.campaign_status,
             current_snapshot_id = s.id, first_published_at = now()
        from snapshot s where c.id = s.campaign_id`;
    if (state === "closed") {
      await sql`update campaigns.campaigns set status = 'closed' where id = ${id}::uuid`;
    }
  });
  return id;
}

/** The state the base holds for a campaign: the screen says it, the base tells it is so. */
export async function campaignStateOf(id: string): Promise<string> {
  return withSql(async (sql) => {
    const [row] = await sql<{ status: string }[]>`
      select status::text as status from campaigns.campaigns where id = ${id}::uuid`;
    return row?.status ?? "";
  });
}

/**
 * A campaign left waiting leaves an open entry in queue 7, which every later run of the suite would find in the
 * queue of its colleagues (15 RG36): the journey withdraws it when it is done, as an erasure would (0310).
 */
export async function withdrawOpenEntries(
  campaignIds: readonly string[],
): Promise<void> {
  await withSql(async (sql) => {
    await sql`
      update campaigns.campaign_review_entries
         set state = 'withdrawn', closed_at = now()
       where state = 'open' and campaign_id = any(${[...campaignIds]}::uuid[])`;
  });
}
