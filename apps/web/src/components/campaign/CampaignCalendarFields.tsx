"use client";

// Step 5 of the campaign form, "Calendrier et candidature" (docs/mvp/17 §4.3, M3; 09 RG69 to RG82;
// jalons/l3b, commit 10): the four civil dates, in the order RG70 imposes (a date out of order is
// refused with a sentence that names the two dates in conflict, `errors.datesOrder`), then what a
// creator is asked to prepare and the ceiling of applications. The field "reserved for verified
// profiles" is absent: it exists in the database but is switched off by a parameter, and a switch that
// is visible but inoperative is worse than no switch (RG79). The campaign says it plainly: applying
// opens no conversation (RG80). No contact of the brand, no counter of applications (RG81, RG82). Fields
// display the draft and report a change: the rules are campaign-view.ts's and apps/api's.
import { useTranslations } from "next-intl";
import { MultiChoiceField } from "@/components/member/ui/MultiChoiceField";
import { Notice } from "@/components/member/ui/Notice";
import { TextField } from "@/components/member/ui/TextField";
import { CARD_TITLE } from "@/components/member/ui/heading-classes";
import {
  CAMPAIGN_MAX_APPLICATIONS_MAX,
  CAMPAIGN_MAX_APPLICATIONS_MIN,
  CAMPAIGN_REQUESTED_ITEMS_MAX,
} from "./campaign-domain";
import { CAMPAIGN_CARD_CLASSES } from "./campaign-classes";
import {
  useCampaignFieldTexts,
  type CampaignFieldsProps,
} from "./campaign-field-texts";
import { controlIdOf } from "./campaign-view";
import { CountField } from "./CountField";

/** The four dates in the order of the calendar (RG70). */
const DATES = [
  "applicationsCloseOn",
  "contentDueOn",
  "startsOn",
  "endsOn",
] as const;

export function CampaignCalendarFields({
  draft,
  errors,
  options,
  change,
}: CampaignFieldsProps) {
  const t = useTranslations("campaign");
  const tBrand = useTranslations("brandProfile");
  const texts = useCampaignFieldTexts(errors, draft);
  return (
    <>
      <section
        aria-labelledby="campaign-block-calendar"
        className={CAMPAIGN_CARD_CLASSES}
      >
        <h3 id="campaign-block-calendar" className={CARD_TITLE}>
          {t("form.blocks.calendar")}
        </h3>
        {DATES.map((key) => (
          <TextField
            key={key}
            id={controlIdOf(key)}
            name={key}
            type="date"
            value={draft[key]}
            maxLength={10}
            onChange={(value) => change(key, value)}
            {...texts(
              key,
              "public",
              t(`fields.${key}.label`),
              t(`fields.${key}.help`),
            )}
          />
        ))}
      </section>

      <section
        aria-labelledby="campaign-block-application"
        className={CAMPAIGN_CARD_CLASSES}
      >
        <h3 id="campaign-block-application" className={CARD_TITLE}>
          {t("form.blocks.application")}
        </h3>
        <MultiChoiceField
          id={controlIdOf("requestedItems")}
          options={options.requestedItems}
          value={draft.requestedItems}
          max={CAMPAIGN_REQUESTED_ITEMS_MAX}
          limitText={`${t("fields.requestedItems.help")} ${tBrand(
            "field.limit",
            { max: CAMPAIGN_REQUESTED_ITEMS_MAX },
          )}`}
          countText={tBrand("field.count", {
            count: draft.requestedItems.length,
            max: CAMPAIGN_REQUESTED_ITEMS_MAX,
          })}
          limitReachedText={tBrand("field.limitReached")}
          onChange={(codes) => change("requestedItems", codes)}
          {...texts(
            "requestedItems",
            "public",
            t("fields.requestedItems.label"),
          )}
        />
        <CountField
          id={controlIdOf("maxApplications")}
          name="maxApplications"
          value={draft.maxApplications}
          maxDigits={String(CAMPAIGN_MAX_APPLICATIONS_MAX).length}
          onChange={(value) => change("maxApplications", value)}
          {...texts(
            "maxApplications",
            "public",
            t("fields.maxApplications.label"),
            t("fields.maxApplications.help", {
              min: CAMPAIGN_MAX_APPLICATIONS_MIN,
              max: CAMPAIGN_MAX_APPLICATIONS_MAX,
            }),
          )}
        />
        <Notice tone="info" announce={false}>
          {t("application.validationNotice")}
        </Notice>
      </section>
    </>
  );
}
