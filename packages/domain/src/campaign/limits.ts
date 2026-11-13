// Bounds of the texts and the typed values of a campaign (docs/mvp/09 RG16, RG24, RG46, RG55, RG66,
// RG37, RG76; jalons/l3b/modele.md §2). The database holds the same bounds as its checks (0303: the
// upper ones in every state, the lower ones outside draft and rejected): the schemas and the screens
// read these constants, never a copy. Margins are those of String.prototype.trim() (EC-L2B-06-4).
import { trimmedLength } from "../brand-profile/required.ts";

/** Title (RG16: 10 to 140 characters). */
export const CAMPAIGN_TITLE_MIN_LENGTH = 10;
export const CAMPAIGN_TITLE_MAX_LENGTH = 140;
/** Public summary, the text of the card (RG16: 120 to 400 characters). */
export const CAMPAIGN_SUMMARY_MIN_LENGTH = 120;
export const CAMPAIGN_SUMMARY_MAX_LENGTH = 400;
/** Detailed brief (RG16: 300 to 4 000 characters). */
export const CAMPAIGN_BRIEF_MIN_LENGTH = 300;
export const CAMPAIGN_BRIEF_MAX_LENGTH = 4000;
/** Product or service (RG24: 20 to 600 characters). */
export const CAMPAIGN_PRODUCT_MIN_LENGTH = 20;
export const CAMPAIGN_PRODUCT_MAX_LENGTH = 600;
/** Restrictions and points of attention (RG24: 1 000 characters at most). */
export const CAMPAIGN_RESTRICTIONS_MAX_LENGTH = 1000;
/** Internal reference of the brand, never published (RG16: 40 characters at most). */
export const CAMPAIGN_INTERNAL_REFERENCE_MAX_LENGTH = 40;
/** One key message (RG24: 10 to 200 characters; the table accepts 1 to 200, the submission 10). */
export const CAMPAIGN_KEY_MESSAGE_MIN_LENGTH = 10;
export const CAMPAIGN_KEY_MESSAGE_MAX_LENGTH = 200;

/** Ceilings of the lists (RG24, RG34, RG37, RG46, RG76). */
export const CAMPAIGN_KEY_MESSAGES_MAX = 5;
export const CAMPAIGN_DELIVERABLES_MAX = 10;
export const CAMPAIGN_DELIVERABLE_QUANTITY_MAX = 20;
export const CAMPAIGN_USAGE_TERRITORIES_MAX = 5;
export const CAMPAIGN_AUDIENCE_COUNTRIES_MAX = 5;
export const CAMPAIGN_TOPICS_MAX = 3;
export const CAMPAIGN_REQUESTED_ITEMS_MAX = 4;

/** Creators wanted (RG55, RG66: an integer from 1 to 50). */
export const CAMPAIGN_CREATORS_WANTED_MIN = 1;
export const CAMPAIGN_CREATORS_WANTED_MAX = 50;
/** Ceiling on applications (RG76, RG78: an integer from 1 to 200). */
export const CAMPAIGN_MAX_APPLICATIONS_MIN = 1;
export const CAMPAIGN_MAX_APPLICATIONS_MAX = 200;

function within(
  value: string | null | undefined,
  min: number,
  max: number,
): boolean {
  const length = trimmedLength(value);
  return length >= min && length <= max;
}

/** Whether a text is long enough to count as entered (RG16, RG24), margins excluded. */
export function hasCampaignTitle(value: string | null | undefined): boolean {
  return trimmedLength(value) >= CAMPAIGN_TITLE_MIN_LENGTH;
}
export function hasCampaignSummary(value: string | null | undefined): boolean {
  return trimmedLength(value) >= CAMPAIGN_SUMMARY_MIN_LENGTH;
}
export function hasCampaignBrief(value: string | null | undefined): boolean {
  return trimmedLength(value) >= CAMPAIGN_BRIEF_MIN_LENGTH;
}
export function hasCampaignProduct(value: string | null | undefined): boolean {
  return trimmedLength(value) >= CAMPAIGN_PRODUCT_MIN_LENGTH;
}

/** Whether a text is inside the bounds of its rule: what a save and a submission accept. */
export function isCampaignTitleLengthAllowed(value: string): boolean {
  return within(value, CAMPAIGN_TITLE_MIN_LENGTH, CAMPAIGN_TITLE_MAX_LENGTH);
}
export function isCampaignSummaryLengthAllowed(value: string): boolean {
  return within(
    value,
    CAMPAIGN_SUMMARY_MIN_LENGTH,
    CAMPAIGN_SUMMARY_MAX_LENGTH,
  );
}
export function isCampaignBriefLengthAllowed(value: string): boolean {
  return within(value, CAMPAIGN_BRIEF_MIN_LENGTH, CAMPAIGN_BRIEF_MAX_LENGTH);
}
export function isCampaignProductLengthAllowed(value: string): boolean {
  return within(
    value,
    CAMPAIGN_PRODUCT_MIN_LENGTH,
    CAMPAIGN_PRODUCT_MAX_LENGTH,
  );
}
export function isCampaignKeyMessageLengthAllowed(value: string): boolean {
  return within(
    value,
    CAMPAIGN_KEY_MESSAGE_MIN_LENGTH,
    CAMPAIGN_KEY_MESSAGE_MAX_LENGTH,
  );
}
/** Restrictions and internal reference are optional: an upper bound only, empty allowed. */
export function isCampaignRestrictionsLengthAllowed(value: string): boolean {
  return trimmedLength(value) <= CAMPAIGN_RESTRICTIONS_MAX_LENGTH;
}
export function isCampaignInternalReferenceLengthAllowed(
  value: string,
): boolean {
  return trimmedLength(value) <= CAMPAIGN_INTERNAL_REFERENCE_MAX_LENGTH;
}

/** Whether a number of creators is an integer from 1 to 50 (RG55, RG66). */
export function isCreatorsWantedAllowed(value: number): boolean {
  return (
    Number.isInteger(value) &&
    value >= CAMPAIGN_CREATORS_WANTED_MIN &&
    value <= CAMPAIGN_CREATORS_WANTED_MAX
  );
}

/** Whether a ceiling on applications is an integer from 1 to 200 (RG76, RG78). */
export function isMaxApplicationsAllowed(value: number): boolean {
  return (
    Number.isInteger(value) &&
    value >= CAMPAIGN_MAX_APPLICATIONS_MIN &&
    value <= CAMPAIGN_MAX_APPLICATIONS_MAX
  );
}
