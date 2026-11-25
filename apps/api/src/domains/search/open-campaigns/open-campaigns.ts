// The creator's read of the open campaigns, from the answers of the doors of the base to the strict
// contract (docs/mvp/11 RG15, RG16, RG21, RG24, RG35; 09 RG98; D46, D48, D78; jalons/l3d/modele.md §3,
// §4; fiche invariants 1, 2, 5). Nothing is read here but what a door returned, and every answer is
// checked WHOLE and strict before anything is chosen from it:
// - the campaign: the published snapshot, through campaignCreatorViewSchema as it is (L3C froze it
//   from campaigns.campaign_creator_view()); the card keeps the keys of its `.pick()` of that schema;
// - the brand: the row of search.brand_public_row(), through publishedBrandPublicRowSchema (the exact
//   keys of PublishedBrandPublicRow), then brandPublicViewOf(), THE one mapping of the public view
//   (profiles/brand-public-view.ts); the card keeps the keys of its `.pick()` of the public view;
// - the notice « À négocier avec votre commercial » after the nature of the consideration (D78).
// A door's answer of another shape fails here (a 500), rather than reach a creator.
import {
  CAMPAIGN_REMUNERATION_NOTICE,
  campaignCreatorViewSchema,
} from "@influx/contracts/campaign-creator-view";
import {
  openCampaignCardBrandSchema,
  openCampaignCardCampaignSchema,
  openCampaignCardSchema,
  openCampaignRecordResponseSchema,
  openCampaignsResponseSchema,
  type OpenCampaignCard,
  type OpenCampaignRecordResponse,
  type OpenCampaignsResponse,
  type OpenCampaignSort,
} from "@influx/contracts/open-campaigns";
import * as z from "zod";
import type { Transaction } from "../../../db/index.ts";
import {
  brandPublicViewOf,
  publishedBrandPublicRowSchema,
} from "../../profiles/brand-public-view.ts";
import { callOpenCampaignDoor, callOpenCampaignsDoor } from "./repository.ts";

const civilDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** A refusal the base committed with its line: answered after the COMMIT (modele §7). */
export type OpenCampaignRefusal =
  | { outcome: "rate_limited"; retryAfterSeconds: number }
  | { outcome: "page_cap"; maxPages: number }
  | { outcome: "refused" };

const rateLimitedSchema = z.strictObject({
  outcome: z.literal("rate_limited"),
  retryAfterSeconds: z.number().int().min(1),
});

/** One item of the door of the feed (0314 §7.1): the snapshot whole and the brand row whole. */
const feedItemSchema = z.strictObject({
  id: z.uuid(),
  publishedOn: civilDateSchema,
  applicationsClosed: z.boolean(),
  campaign: campaignCreatorViewSchema,
  brand: publishedBrandPublicRowSchema,
});

const feedAnswerSchema = z.discriminatedUnion("outcome", [
  z.strictObject({
    outcome: z.literal("served"),
    total: z.number().int().min(0),
    page: z.number().int().min(1),
    nextPage: z.number().int().min(2).nullable(),
    capReached: z.boolean(),
    items: z.array(feedItemSchema),
  }),
  z.strictObject({
    outcome: z.literal("page_cap"),
    maxPages: z.number().int().min(1),
  }),
  rateLimitedSchema,
]);

const recordAnswerSchema = z.discriminatedUnion("outcome", [
  z.strictObject({
    outcome: z.literal("served"),
    id: z.uuid(),
    publishedOn: civilDateSchema,
    campaign: campaignCreatorViewSchema,
    brand: publishedBrandPublicRowSchema,
  }),
  z.strictObject({ outcome: z.literal("refused") }),
  rateLimitedSchema,
]);

/** The keys of a `.pick()` schema, taken from a value already checked whole by its full schema. */
function pickOf<Schema extends z.ZodObject>(
  schema: Schema,
  whole: Readonly<Record<string, unknown>>,
): z.infer<Schema> {
  return schema.parse(
    Object.fromEntries(
      Object.keys(schema.shape).map((key) => [key, whole[key]]),
    ),
  );
}

/** A card of the feed (RG15 at the pilot, modele §3): picks of the two views, nothing of its own. */
function cardOf(item: z.infer<typeof feedItemSchema>): OpenCampaignCard {
  return openCampaignCardSchema.parse({
    id: item.id,
    publishedOn: item.publishedOn,
    applicationsClosed: item.applicationsClosed,
    campaign: pickOf(openCampaignCardCampaignSchema, item.campaign),
    brand: pickOf(openCampaignCardBrandSchema, brandPublicViewOf(item.brand)),
    remunerationNotice: CAMPAIGN_REMUNERATION_NOTICE,
  });
}

/** GET /v1/open-campaigns: a page of the feed, or the refusal the base journaled. */
export async function readOpenCampaigns(
  tx: Transaction,
  sort: OpenCampaignSort,
  page: number,
): Promise<OpenCampaignsResponse | OpenCampaignRefusal> {
  const answer = feedAnswerSchema.parse(
    await callOpenCampaignsDoor(tx, sort, page),
  );
  if (answer.outcome !== "served") {
    return answer;
  }
  return openCampaignsResponseSchema.parse({
    total: answer.total,
    page: answer.page,
    nextPage: answer.nextPage,
    capReached: answer.capReached,
    items: answer.items.map(cardOf),
  });
}

/** GET /v1/open-campaigns/:id: the record of an open campaign, or the refusal the base journaled. */
export async function readOpenCampaign(
  tx: Transaction,
  campaignId: string,
): Promise<OpenCampaignRecordResponse | OpenCampaignRefusal> {
  const answer = recordAnswerSchema.parse(
    await callOpenCampaignDoor(tx, campaignId),
  );
  if (answer.outcome !== "served") {
    return answer;
  }
  return openCampaignRecordResponseSchema.parse({
    id: answer.id,
    publishedOn: answer.publishedOn,
    campaign: answer.campaign,
    brand: brandPublicViewOf(answer.brand),
    remunerationNotice: CAMPAIGN_REMUNERATION_NOTICE,
  });
}

/** Whether an answer is a refusal of the base rather than what the route serves. */
export function isRefusal<Served extends object>(
  value: Served | OpenCampaignRefusal,
): value is OpenCampaignRefusal {
  return "outcome" in value;
}
