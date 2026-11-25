"use client";

// Step 3 of the campaign form, "Pour qui" (docs/mvp/17 §4.3, M3; 09 RG46 to RG54): the countries,
// the languages and the topics aimed at, then the size, the age bands and the gender split wished,
// which are recommended. Everything here describes the AUDIENCE aimed at, never the creator as a
// person (RG47, RG48): no label, no help reads as a criterion about the creator. Sizes are bands, no
// number; no age band under 18 exists (RG51); the gender split has no default, no answer meaning "no
// preference" (RG52). The targeting filters nothing at the MVP (RG53). Fields display the draft and
// report a change: the rules are campaign-view.ts's and apps/api's.
import {
  CAMPAIGN_AUDIENCE_COUNTRIES_MAX,
  CAMPAIGN_TOPICS_MAX,
} from "./campaign-domain";
import { CAMPAIGN_LIST_LIMITS } from "@influx/contracts/campaign";
import { useTranslations } from "next-intl";
import { MemberButton } from "@/components/member/ui/MemberButton";
import { MultiChoiceField } from "@/components/member/ui/MultiChoiceField";
import { PickListField } from "@/components/member/ui/PickListField";
import { SingleChoiceField } from "@/components/member/ui/SingleChoiceField";
import { CARD_TITLE } from "@/components/member/ui/heading-classes";
import { CAMPAIGN_CARD_CLASSES } from "./campaign-classes";
import {
  useCampaignFieldTexts,
  type CampaignFieldsProps,
} from "./campaign-field-texts";
import { controlIdOf } from "./campaign-view";

export function CampaignAudienceFields({
  draft,
  errors,
  options,
  change,
}: CampaignFieldsProps) {
  const t = useTranslations("campaign");
  const tBrand = useTranslations("brandProfile");
  const texts = useCampaignFieldTexts(errors, draft);
  const free = tBrand("field.limitFree");
  const chosen = (count: number) => tBrand("field.chosen", { count });
  return (
    <>
      <section
        aria-labelledby="campaign-block-audience"
        className={CAMPAIGN_CARD_CLASSES}
      >
        <h3 id="campaign-block-audience" className={CARD_TITLE}>
          {t("form.blocks.audience")}
        </h3>
        <PickListField
          id={controlIdOf("audienceCountries")}
          name="audienceCountries"
          options={options.countries}
          value={draft.audienceCountries}
          max={CAMPAIGN_AUDIENCE_COUNTRIES_MAX}
          limitText={`${t("fields.audienceCountries.help")} ${tBrand(
            "field.limit",
            {
              max: CAMPAIGN_AUDIENCE_COUNTRIES_MAX,
            },
          )}`}
          countText={tBrand("field.count", {
            count: draft.audienceCountries.length,
            max: CAMPAIGN_AUDIENCE_COUNTRIES_MAX,
          })}
          limitReachedText={tBrand("field.limitReached")}
          addLabel={t("fields.audienceCountries.add")}
          listLabel={tBrand("field.selected")}
          removeLabel={(label) => tBrand("field.remove", { label })}
          onChange={(codes) => change("audienceCountries", codes)}
          {...texts(
            "audienceCountries",
            "public",
            t("fields.audienceCountries.label"),
          )}
        />
        <PickListField
          id={controlIdOf("audienceLanguages")}
          name="audienceLanguages"
          options={options.languages}
          value={draft.audienceLanguages}
          max={CAMPAIGN_LIST_LIMITS.audienceLanguages}
          limitText={free}
          countText={chosen(draft.audienceLanguages.length)}
          limitReachedText={tBrand("field.limitReached")}
          addLabel={t("fields.audienceLanguages.add")}
          listLabel={tBrand("field.selected")}
          removeLabel={(label) => tBrand("field.remove", { label })}
          onChange={(codes) => change("audienceLanguages", codes)}
          {...texts(
            "audienceLanguages",
            "public",
            t("fields.audienceLanguages.label"),
          )}
        />
        <MultiChoiceField
          id={controlIdOf("audienceTopics")}
          options={options.topics}
          value={draft.audienceTopics}
          max={CAMPAIGN_TOPICS_MAX}
          limitText={tBrand("field.limit", { max: CAMPAIGN_TOPICS_MAX })}
          countText={tBrand("field.count", {
            count: draft.audienceTopics.length,
            max: CAMPAIGN_TOPICS_MAX,
          })}
          limitReachedText={tBrand("field.limitReached")}
          onChange={(codes) => change("audienceTopics", codes)}
          {...texts(
            "audienceTopics",
            "public",
            t("fields.audienceTopics.label"),
          )}
        />
      </section>

      <section
        aria-labelledby="campaign-block-audience-more"
        className={CAMPAIGN_CARD_CLASSES}
      >
        <h3 id="campaign-block-audience-more" className={CARD_TITLE}>
          {t("form.blocks.audienceMore")}
        </h3>
        <MultiChoiceField
          id={controlIdOf("audienceBands")}
          options={options.audienceBands}
          value={draft.audienceBands}
          max={CAMPAIGN_LIST_LIMITS.audienceBands}
          limitText={`${t("fields.audienceBands.help")} ${free}`}
          countText={chosen(draft.audienceBands.length)}
          limitReachedText={tBrand("field.limitReached")}
          onChange={(codes) => change("audienceBands", codes)}
          {...texts("audienceBands", "public", t("fields.audienceBands.label"))}
        />
        <MultiChoiceField
          id={controlIdOf("audienceAgeBands")}
          options={options.audienceAgeBands}
          value={draft.audienceAgeBands}
          max={CAMPAIGN_LIST_LIMITS.audienceAgeBands}
          limitText={`${t("fields.audienceAgeBands.help")} ${free}`}
          countText={chosen(draft.audienceAgeBands.length)}
          limitReachedText={tBrand("field.limitReached")}
          onChange={(codes) => change("audienceAgeBands", codes)}
          {...texts(
            "audienceAgeBands",
            "public",
            t("fields.audienceAgeBands.label"),
          )}
        />
        <SingleChoiceField
          id={controlIdOf("audienceGender")}
          name="audienceGender"
          display="radios"
          options={options.audienceGenders}
          value={draft.audienceGender}
          onChange={(code) => change("audienceGender", code)}
          {...texts(
            "audienceGender",
            "public",
            t("fields.audienceGender.label"),
            t("fields.audienceGender.help"),
          )}
        />
        {draft.audienceGender === null ? null : (
          // No answer is "no preference" (RG52): the choice is taken back, never defaulted.
          <MemberButton
            variant="text"
            className="self-start"
            onClick={() => change("audienceGender", null)}
          >
            {t("field.clearChoice")}
          </MemberButton>
        )}
      </section>
    </>
  );
}
