// Calls of "mes campagnes" and of the campaign form (docs/mvp/17 §4.3; 09 RG4, RG108; jalons/l3b,
// commit 09). Each one goes through the same-origin relay (@influx/web-platform/relay-client) and
// reads the answer with the schema of packages/contracts. No rule lives here: apps/api decides, the
// screen displays. The account is always the session's: no call names an account, and the only
// identifier of a path is the campaign's own, opaque.
import {
  campaignListResponseSchema,
  campaignResponseSchema,
  type CampaignListResponse,
  type CampaignResponse,
} from "@influx/contracts/campaign";
import { callRelay, type RelayResult } from "@influx/web-platform/relay-client";

const CAMPAIGNS_PATH = "/v1/me/campaigns";

export function readCampaignList(): Promise<RelayResult<CampaignListResponse>> {
  return callRelay("GET", CAMPAIGNS_PATH, campaignListResponseSchema);
}

/** A draft, empty: the form's first save is the member's first key (RG108: never refused for what it lacks). */
export function createCampaignDraft(): Promise<RelayResult<CampaignResponse>> {
  return callRelay("POST", CAMPAIGNS_PATH, campaignResponseSchema, {});
}

export function readCampaign(
  id: string,
): Promise<RelayResult<CampaignResponse>> {
  return callRelay("GET", `${CAMPAIGNS_PATH}/${id}`, campaignResponseSchema);
}

/** The autosave: the fields that changed only; a list is sent whole (RG108). */
export function saveCampaignFields(
  id: string,
  body: Record<string, unknown>,
): Promise<RelayResult<CampaignResponse>> {
  return callRelay(
    "PATCH",
    `${CAMPAIGNS_PATH}/${id}`,
    campaignResponseSchema,
    body,
  );
}
