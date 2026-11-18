// Calls of the creator's feed of open campaigns (docs/mvp/11 RG13 to RG26, RG33, RG35, RG36; 17 §5.5; jalons/l3d,
// commit 04). Each one goes through the same-origin relay (@influx/web-platform/relay-client) and reads the
// answer with the schema of packages/contracts (`@influx/contracts/open-campaigns`). No rule lives here: apps/api
// decides what is visible, in which order, how many, and how often a creator may read; the screen displays. The
// account is always the session's, and the only identifier of a path is the campaign's own, opaque (RG39).
import {
  openCampaignBrandLogoResponseSchema,
  openCampaignsResponseSchema,
  type OpenCampaignBrandLogoResponse,
  type OpenCampaignSort,
  type OpenCampaignsResponse,
} from "@influx/contracts/open-campaigns";
import { callRelay, type RelayResult } from "@influx/web-platform/relay-client";

const OPEN_CAMPAIGNS_PATH = "/v1/open-campaigns";

/** One page of the feed: the sort and the rank of the page (1 first), the count and `nextPage` in the answer. */
export function readOpenCampaigns(
  sort: OpenCampaignSort,
  page: number,
): Promise<RelayResult<OpenCampaignsResponse>> {
  return callRelay(
    "GET",
    OPEN_CAMPAIGNS_PATH,
    openCampaignsResponseSchema,
    undefined,
    { sort, page: String(page) },
  );
}

/** The logo of the brand of a card, relayed as JSON; `{ logo: null }` without one, a refusal when it is not visible. */
export function readOpenCampaignBrandLogo(
  id: string,
): Promise<RelayResult<OpenCampaignBrandLogoResponse>> {
  return callRelay(
    "GET",
    `${OPEN_CAMPAIGNS_PATH}/${id}/brand-logo`,
    openCampaignBrandLogoResponseSchema,
  );
}
