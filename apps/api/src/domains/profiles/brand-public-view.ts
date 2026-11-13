// THE public view of a brand profile: what a creator sees of a brand with a published campaign
// (docs/mvp/06 RG73, RG74 "before", RG38; 09 RG98, CA64; jalons/l3b/modele.md §6, commit 08). ONE
// module, the only place in apps/api that builds it: the brand's preview of a campaign
// (GET /v1/me/campaigns/:id/creator-view) serves it as it is, and the creator's read of L3D calls the
// same mapping, never a copy. Read live (RG2): never copied into a campaign nor into its snapshot.
// An ALLOW-LIST of the published profile: the public identity, the expectations, the badge and its
// date, the ROLE of the contact person. Never the first name, the e-mail, the phone or the contact
// page (06 RG38, D46), the registered name or number (internal block), the completeness, the state,
// a change waiting for review (06 RG9), an account identifier. No amount, no budget band (D48, D78:
// the indicative budget of the profile is not even entered).
import {
  campaignBrandViewSchema,
  type CampaignBrandView,
} from "@influx/contracts/campaign-creator-view";
import type { Transaction } from "../../db/index.ts";
import {
  readOwnPublishedBrandPublicRow,
  type PublishedBrandPublicRow,
} from "./repository.ts";

/** The public view of a published profile row (the mapping L3D reuses for another brand). */
export function brandPublicViewOf(
  row: PublishedBrandPublicRow,
): CampaignBrandView {
  return campaignBrandViewSchema.parse({
    companyName: row.legal_name,
    hasLogo: row.has_logo === true,
    primarySector: row.primary_sector_code,
    secondarySectors: row.secondarySectors,
    companySize: row.company_size_band,
    country: row.country,
    targetMarkets: row.targetMarkets,
    workingLanguages: row.workingLanguages,
    website: row.website_domain,
    presentation: row.presentation,
    topics: row.topics,
    networks: row.networks,
    formats: row.formats,
    audienceCountries: row.audienceCountries,
    usageRights: row.usageRights,
    exclusivityBand: row.exclusivity_band,
    collaborationRhythm: row.collaboration_rhythm,
    offersNonMonetary: row.offers_non_monetary,
    contactRole: row.contact_role,
    badge:
      row.badge_granted_at === null ? null : { since: row.badge_granted_at },
  });
}

/**
 * The public view of the session's own brand profile, or null while it is not published: a creator
 * never sees a profile in draft, under review, refused or suspended (06 RG73).
 */
export async function readOwnBrandPublicView(
  tx: Transaction,
): Promise<CampaignBrandView | null> {
  const row = await readOwnPublishedBrandPublicRow(tx);
  return row === null ? null : brandPublicViewOf(row);
}
