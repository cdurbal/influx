"use client";

// Step 2 of the campaign form, "Le travail attendu" (docs/mvp/17 §4.3, M3; 09 RG34 to RG45): the
// deliverables, the usage rights with their duration and territory, the sector exclusivity and the
// time the brand takes to review a content. The duration and the territory are asked only when the
// rights are not "none" (RG39), and an answer that makes them inapplicable empties them in the same
// save (EC-L3B-07-1, applyChange). Nothing here asks for a file (RG45). Fields display the draft and
// report a change: the rules are campaign-view.ts's and apps/api's.
import {
  CAMPAIGN_NO_USAGE_RIGHTS,
  CAMPAIGN_TERRITORY_SELECTED,
  CAMPAIGN_USAGE_TERRITORIES_MAX,
} from "./campaign-domain";
import { useTranslations } from "next-intl";
import { PickListField } from "@/components/member/ui/PickListField";
import { SingleChoiceField } from "@/components/member/ui/SingleChoiceField";
import { CARD_TITLE } from "@/components/member/ui/heading-classes";
import { CAMPAIGN_CARD_CLASSES } from "./campaign-classes";
import {
  useCampaignFieldTexts,
  type CampaignFieldsProps,
} from "./campaign-field-texts";
import { controlIdOf } from "./campaign-view";
import { DeliverablesField } from "./DeliverablesField";

export function CampaignWorkFields(props: CampaignFieldsProps) {
  const { references, draft, errors, options, change } = props;
  const t = useTranslations("campaign");
  const tBrand = useTranslations("brandProfile");
  const texts = useCampaignFieldTexts(errors, draft);
  const rightsGranted =
    draft.usageRights !== null &&
    draft.usageRights !== CAMPAIGN_NO_USAGE_RIGHTS;
  const selectedCountries =
    draft.usageRightsTerritoryScope === CAMPAIGN_TERRITORY_SELECTED;
  return (
    <>
      <section
        aria-labelledby="campaign-block-deliverables"
        className={CAMPAIGN_CARD_CLASSES}
      >
        <h3 id="campaign-block-deliverables" className={CARD_TITLE}>
          {t("form.blocks.deliverables")}
        </h3>
        <DeliverablesField
          references={references}
          draft={draft}
          errors={errors}
          options={options}
          change={change}
        />
      </section>

      <section
        aria-labelledby="campaign-block-rights"
        className={CAMPAIGN_CARD_CLASSES}
      >
        <h3 id="campaign-block-rights" className={CARD_TITLE}>
          {t("form.blocks.rights")}
        </h3>
        <SingleChoiceField
          id={controlIdOf("usageRights")}
          name="usageRights"
          display="radios"
          options={options.usageRights}
          value={draft.usageRights}
          onChange={(code) => change("usageRights", code)}
          {...texts("usageRights", "public", t("fields.usageRights.label"))}
        />
        {rightsGranted ? (
          <>
            <SingleChoiceField
              id={controlIdOf("usageRightsDuration")}
              name="usageRightsDuration"
              display="radios"
              options={options.usageDurations}
              value={draft.usageRightsDuration}
              onChange={(code) => change("usageRightsDuration", code)}
              {...texts(
                "usageRightsDuration",
                "public",
                t("fields.usageRightsDuration.label"),
              )}
            />
            <SingleChoiceField
              id={controlIdOf("usageRightsTerritoryScope")}
              name="usageRightsTerritoryScope"
              display="radios"
              options={options.usageTerritories}
              value={draft.usageRightsTerritoryScope}
              onChange={(code) => change("usageRightsTerritoryScope", code)}
              {...texts(
                "usageRightsTerritoryScope",
                "public",
                t("fields.usageRightsTerritoryScope.label"),
              )}
            />
            {selectedCountries ? (
              <PickListField
                id={controlIdOf("usageRightsTerritories")}
                name="usageRightsTerritories"
                options={options.countries}
                value={draft.usageRightsTerritories}
                max={CAMPAIGN_USAGE_TERRITORIES_MAX}
                limitText={tBrand("field.limit", {
                  max: CAMPAIGN_USAGE_TERRITORIES_MAX,
                })}
                countText={tBrand("field.count", {
                  count: draft.usageRightsTerritories.length,
                  max: CAMPAIGN_USAGE_TERRITORIES_MAX,
                })}
                limitReachedText={tBrand("field.limitReached")}
                addLabel={t("fields.usageRightsTerritories.add")}
                listLabel={tBrand("field.selected")}
                removeLabel={(label) => tBrand("field.remove", { label })}
                onChange={(codes) => change("usageRightsTerritories", codes)}
                {...texts(
                  "usageRightsTerritories",
                  "public",
                  t("fields.usageRightsTerritories.label"),
                )}
              />
            ) : null}
          </>
        ) : null}
        <SingleChoiceField
          id={controlIdOf("exclusivity")}
          name="exclusivity"
          display="radios"
          options={options.exclusivities}
          value={draft.exclusivity}
          onChange={(code) => change("exclusivity", code)}
          {...texts("exclusivity", "public", t("fields.exclusivity.label"))}
        />
      </section>

      <section
        aria-labelledby="campaign-block-review"
        className={CAMPAIGN_CARD_CLASSES}
      >
        <h3 id="campaign-block-review" className={CARD_TITLE}>
          {t("form.blocks.review")}
        </h3>
        <SingleChoiceField
          id={controlIdOf("contentReviewDelay")}
          name="contentReviewDelay"
          display="radios"
          options={options.reviewDelays}
          value={draft.contentReviewDelay}
          onChange={(code) => change("contentReviewDelay", code)}
          {...texts(
            "contentReviewDelay",
            "public",
            t("fields.contentReviewDelay.label"),
            t("fields.contentReviewDelay.help"),
          )}
        />
      </section>
    </>
  );
}
