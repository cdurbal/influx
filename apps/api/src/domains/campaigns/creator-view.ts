// "Ce que voit un créateur": the brand's preview of its own campaign (docs/mvp/09 RG98, RG102, CA41,
// CA44, CA64, CA68, CA75; D48, D78; jalons/l3b/modele.md §6, commit 08). The answer is EXACTLY what
// the service serves, never a reconstruction (RG102):
// - the campaign: the ONE constructor, campaigns.campaign_creator_view() (0305), the allow-list L3C
//   freezes into the snapshot of a published campaign and L3D serves to a creator; passed through
//   the strict contract as it is, no key added, renamed or dropped here, no internal column read to
//   choose what is served;
// - the brand: the published profile, read live (RG2) by the one module that builds it
//   (profiles/brand-public-view.ts); null while the profile is not published (06 RG73);
// - the notice « À négocier avec votre commercial » after the nature of the consideration (D78).
// No currency, band, total budget, internal reference, declaration, sensitivity, state, identifier
// nor amount reaches this answer (fiche invariants 1 and 2; CLAUDE.md §2).
import {
  campaignCreatorViewResponseSchema,
  campaignCreatorViewSchema,
  CAMPAIGN_REMUNERATION_NOTICE,
  type CampaignCreatorViewResponse,
} from "@influx/contracts/campaign-creator-view";
import type { Transaction } from "../../db/index.ts";
import { readOwnBrandPublicView } from "../profiles/brand-public-view.ts";
import { readCreatorViewOfOwnCampaign } from "./repository.ts";

/**
 * GET /v1/me/campaigns/:id/creator-view: null when the id is nobody's or another brand's (T14), the
 * same answer as an unknown campaign.
 */
export async function readCampaignCreatorView(
  tx: Transaction,
  campaignId: string,
): Promise<CampaignCreatorViewResponse | null> {
  const view = await readCreatorViewOfOwnCampaign(tx, campaignId);
  if (view === null) {
    return null;
  }
  return campaignCreatorViewResponseSchema.parse({
    // strict: a key the base would add, or lose, fails here rather than reach a creator
    campaign: campaignCreatorViewSchema.parse(view),
    remunerationNotice: CAMPAIGN_REMUNERATION_NOTICE,
    brand: await readOwnBrandPublicView(tx),
  });
}
