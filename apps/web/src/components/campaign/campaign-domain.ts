// The ONE door of the campaign screens to packages/domain (docs/mvp/09 RG14: the form reads the very
// rules the API applies; jalons/l3b, commit 09): the bounds of the texts and of the lists, the steps and
// the step of each required field, the "none" of the usage rights, the territories, and the detection of
// RG21 to RG23. Re-exported here so that the front imports the domain from one file, which
// apps/api/tests/domain-guards.test.ts names; nothing is added to what the domain says.
export {
  CAMPAIGN_AUDIENCE_COUNTRIES_MAX,
  CAMPAIGN_BRIEF_MAX_LENGTH,
  CAMPAIGN_DELIVERABLE_QUANTITY_MAX,
  CAMPAIGN_DELIVERABLES_MAX,
  CAMPAIGN_INTERNAL_REFERENCE_MAX_LENGTH,
  CAMPAIGN_KEY_MESSAGE_MAX_LENGTH,
  CAMPAIGN_KEY_MESSAGES_MAX,
  CAMPAIGN_NO_USAGE_RIGHTS,
  CAMPAIGN_PRODUCT_MAX_LENGTH,
  CAMPAIGN_REQUIRED_FIELD_STEP,
  CAMPAIGN_RESTRICTIONS_MAX_LENGTH,
  CAMPAIGN_STEPS,
  CAMPAIGN_SUMMARY_MAX_LENGTH,
  CAMPAIGN_TERRITORY_SELECTED,
  CAMPAIGN_TERRITORY_WORLDWIDE,
  CAMPAIGN_TEXT_KINDS,
  CAMPAIGN_TEXT_WARNING_CODE,
  CAMPAIGN_TITLE_MAX_LENGTH,
  CAMPAIGN_TOPICS_MAX,
  CAMPAIGN_USAGE_TERRITORIES_MAX,
  campaignTextKinds,
  type CampaignRequiredField,
  type CampaignStep,
} from "@influx/domain/campaign";
