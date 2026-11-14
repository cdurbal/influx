"use client";

// Step 4 of the campaign form, "Le budget" (docs/mvp/17 §4.3, M3; 09 RG55 to RG66 under the pilot
// regime of D78, extended to Lot 3 by the founder on 2026-11-13; jalons/l3b, commit 10). The brand
// states the nature of the consideration and the number of creators wanted, then, in a box that says
// "Interne — jamais publié", the currency and the BAND of budget per creator it pays in total,
// commission included (the help `budget.bandBrand`, told before the choice, CA37): a band of the grid
// of the currency, never an amount, seen by the brand and its INFLUX account manager alone. "Gift
// only" asks no band (RG63, CA76). The last block shows what a creator sees of this budget: the
// nature and "À négocier avec votre commercial" (`budget.negotiate`), no amount, no band, no net
// (D48, D78). No percentage and no commission figure is written anywhere on this step. The total
// budget of RG55 is not typed here (EC-L3B-10-1: the conversion of a typed amount into the minor unit
// is the exemption of T16.6, which no function holds yet). Fields display the draft and report a
// change: the rules are campaign-view.ts's and apps/api's. The box ends on the way to the preview of what a
// creator sees (L3B, commit 11), the page that shows it for real.
import { useLocale, useTranslations } from "next-intl";
import { TEXT_LINK_CLASSES } from "@/components/auth/auth-classes";
import { Notice } from "@/components/member/ui/Notice";
import { SingleChoiceField } from "@/components/member/ui/SingleChoiceField";
import { CARD_TITLE } from "@/components/member/ui/heading-classes";
import { Link } from "@/i18n/navigation";
import { memberPageHref } from "@/lib/member-paths";
import {
  CAMPAIGN_CREATORS_WANTED_MAX,
  CAMPAIGN_CREATORS_WANTED_MIN,
} from "./campaign-domain";
import { CAMPAIGN_CARD_CLASSES } from "./campaign-classes";
import {
  useCampaignFieldTexts,
  type CampaignFieldsProps,
} from "./campaign-field-texts";
import { bandOptionsOf } from "./campaign-options";
import { controlIdOf, isGiftOnly } from "./campaign-view";
import { CountField } from "./CountField";

export function CampaignBudgetFields({
  campaign,
  references,
  draft,
  errors,
  options,
  change,
}: CampaignFieldsProps) {
  const t = useTranslations("campaign");
  const locale = useLocale();
  const tBrand = useTranslations("brandProfile");
  const texts = useCampaignFieldTexts(errors, draft);
  const bands = bandOptionsOf(t, references, draft.currency);
  const giftOnly = isGiftOnly(draft);
  const nature = options.remunerations.find(
    (option) => option.code === draft.remunerationKind,
  );
  return (
    <>
      <section
        aria-labelledby="campaign-block-remuneration"
        className={CAMPAIGN_CARD_CLASSES}
      >
        <h3 id="campaign-block-remuneration" className={CARD_TITLE}>
          {t("form.blocks.remuneration")}
        </h3>
        <SingleChoiceField
          id={controlIdOf("remunerationKind")}
          name="remunerationKind"
          display="radios"
          options={options.remunerations}
          value={draft.remunerationKind}
          onChange={(code) => change("remunerationKind", code)}
          {...texts(
            "remunerationKind",
            "public",
            t("fields.remunerationKind.label"),
          )}
        />
        <CountField
          id={controlIdOf("creatorsWanted")}
          name="creatorsWanted"
          value={draft.creatorsWanted}
          maxDigits={String(CAMPAIGN_CREATORS_WANTED_MAX).length}
          onChange={(value) => change("creatorsWanted", value)}
          {...texts(
            "creatorsWanted",
            "public",
            t("fields.creatorsWanted.label"),
            t("fields.creatorsWanted.help", {
              min: CAMPAIGN_CREATORS_WANTED_MIN,
              max: CAMPAIGN_CREATORS_WANTED_MAX,
            }),
          )}
        />
      </section>

      <section
        aria-labelledby="campaign-block-internal"
        data-internal-box=""
        className={CAMPAIGN_CARD_CLASSES}
      >
        <h3 id="campaign-block-internal" className={CARD_TITLE}>
          {t("form.blocks.internal")}
        </h3>
        <Notice tone="info" announce={false}>
          {t("budget.internalPilot")}
        </Notice>
        <SingleChoiceField
          id={controlIdOf("currency")}
          name="currency"
          options={options.currencies}
          value={draft.currency}
          placeholder={tBrand("field.choose")}
          onChange={(code) => change("currency", code)}
          {...texts(
            "currency",
            "internal",
            t("fields.currency.label"),
            t("fields.currency.help"),
          )}
        />
        {giftOnly ? (
          <Notice tone="info" announce={false}>
            {t("budget.giftOnly")}
          </Notice>
        ) : (
          <SingleChoiceField
            id={controlIdOf("budgetBand")}
            name="budgetBand"
            options={bands}
            value={draft.budgetBand}
            placeholder={tBrand("field.choose")}
            disabled={draft.currency === null}
            onChange={(code) => change("budgetBand", code)}
            {...texts(
              "budgetBand",
              "internal",
              t("fields.budgetBand.label"),
              draft.currency === null
                ? `${t("budget.bandBrand")} ${t("budget.chooseCurrency")}`
                : t("budget.bandBrand"),
            )}
          />
        )}
      </section>

      <section
        aria-labelledby="campaign-block-creator-sees"
        data-creator-box=""
        className={CAMPAIGN_CARD_CLASSES}
      >
        <h3 id="campaign-block-creator-sees" className={CARD_TITLE}>
          {t("form.blocks.creatorSees")}
        </h3>
        <p className="text-sm text-text-secondary">{t("budget.creatorSees")}</p>
        <p className="font-semibold text-text-primary">
          {nature === undefined
            ? t("budget.noNature")
            : t("budget.creatorNature", { kind: nature.label })}
        </p>
        <p className="text-text-primary">{t("budget.negotiate")}</p>
        <Link
          href={memberPageHref(
            "advertiserCampaignPreview",
            locale,
            campaign.id,
          )}
          className={TEXT_LINK_CLASSES}
        >
          {t("preview.link")}
        </Link>
      </section>
    </>
  );
}
