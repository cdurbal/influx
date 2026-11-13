"use client";

// Step 1 of the campaign form, "L'offre" (docs/mvp/17 §4.3, M3; 09 RG16 to RG33): block 1,
// identification, block 2, product and gift, and the internal reference in its box "Interne — jamais
// publié". Every free text says when it holds what RG21 to RG23 forbid (a contact, a link, an
// amount), under the field, in a warning that blocks nothing and changes nothing. The currency is
// asked here once a product is sent, because the value of the product is a band of the grid of one
// currency (RG30, RG58); step 4 asks the very same field. No file is asked (RG45). No amount is
// typed: the value of the product is a band chosen from the grid, seen by the brand and the INFLUX
// account manager alone (D78). Fields display the draft and report a change: the rules are
// campaign-view.ts's and apps/api's.
import {
  CAMPAIGN_BRIEF_MAX_LENGTH,
  CAMPAIGN_INTERNAL_REFERENCE_MAX_LENGTH,
  CAMPAIGN_PRODUCT_MAX_LENGTH,
  CAMPAIGN_RESTRICTIONS_MAX_LENGTH,
  CAMPAIGN_SUMMARY_MAX_LENGTH,
  CAMPAIGN_TITLE_MAX_LENGTH,
} from "./campaign-domain";
import { useTranslations } from "next-intl";
import { SingleChoiceField } from "@/components/member/ui/SingleChoiceField";
import { TextAreaField } from "@/components/member/ui/TextAreaField";
import { TextField } from "@/components/member/ui/TextField";
import { YesNoField } from "@/components/member/ui/YesNoField";
import { CARD_TITLE } from "@/components/member/ui/heading-classes";
import { Notice } from "@/components/member/ui/Notice";
import { bandOptionsOf } from "./campaign-options";
import { CAMPAIGN_CARD_CLASSES } from "./campaign-classes";
import {
  useCampaignFieldTexts,
  type CampaignFieldsProps,
} from "./campaign-field-texts";
import { controlIdOf } from "./campaign-view";
import { KeyMessagesField } from "./KeyMessagesField";

export function CampaignOfferFields({
  references,
  draft,
  errors,
  options,
  change,
}: CampaignFieldsProps) {
  const t = useTranslations("campaign");
  const tBrand = useTranslations("brandProfile");
  const texts = useCampaignFieldTexts(errors, draft);
  const counter = (count: number, max: number) =>
    tBrand("field.characters", { count, max });
  const bands = bandOptionsOf(t, references, draft.currency);
  return (
    <>
      <section
        aria-labelledby="campaign-block-identification"
        className={CAMPAIGN_CARD_CLASSES}
      >
        <h3 id="campaign-block-identification" className={CARD_TITLE}>
          {t("form.blocks.identification")}
        </h3>
        <TextField
          id={controlIdOf("title")}
          name="title"
          value={draft.title}
          maxLength={CAMPAIGN_TITLE_MAX_LENGTH}
          onChange={(value) => change("title", value)}
          {...texts(
            "title",
            "public",
            t("fields.title.label"),
            t("fields.title.help"),
            [draft.title],
          )}
        />
        <SingleChoiceField
          id={controlIdOf("campaignType")}
          name="campaignType"
          options={options.campaignTypes}
          value={draft.campaignType}
          placeholder={tBrand("field.choose")}
          onChange={(code) => change("campaignType", code)}
          {...texts("campaignType", "public", t("fields.campaignType.label"))}
        />
        <TextAreaField
          id={controlIdOf("publicSummary")}
          name="publicSummary"
          value={draft.publicSummary}
          rows={4}
          maxLength={CAMPAIGN_SUMMARY_MAX_LENGTH}
          counterText={counter}
          onChange={(value) => change("publicSummary", value)}
          {...texts(
            "publicSummary",
            "public",
            t("fields.publicSummary.label"),
            t("fields.publicSummary.help"),
            [draft.publicSummary],
          )}
        />
        <TextAreaField
          id={controlIdOf("brief")}
          name="brief"
          value={draft.brief}
          rows={8}
          maxLength={CAMPAIGN_BRIEF_MAX_LENGTH}
          counterText={counter}
          onChange={(value) => change("brief", value)}
          {...texts(
            "brief",
            "public",
            t("fields.brief.label"),
            t("fields.brief.help"),
            [draft.brief],
          )}
        />
      </section>

      <section
        aria-labelledby="campaign-block-product"
        className={CAMPAIGN_CARD_CLASSES}
      >
        <h3 id="campaign-block-product" className={CARD_TITLE}>
          {t("form.blocks.product")}
        </h3>
        <TextAreaField
          id={controlIdOf("productDescription")}
          name="productDescription"
          value={draft.productDescription}
          rows={3}
          maxLength={CAMPAIGN_PRODUCT_MAX_LENGTH}
          counterText={counter}
          onChange={(value) => change("productDescription", value)}
          {...texts(
            "productDescription",
            "public",
            t("fields.productDescription.label"),
            t("fields.productDescription.help"),
            [draft.productDescription],
          )}
        />
        <SingleChoiceField
          id={controlIdOf("productSector")}
          name="productSector"
          options={options.sectors}
          value={draft.productSector}
          placeholder={tBrand("field.choose")}
          onChange={(code) => change("productSector", code)}
          {...texts("productSector", "public", t("fields.productSector.label"))}
        />
        <KeyMessagesField draft={draft} errors={errors} change={change} />
        <TextAreaField
          id={controlIdOf("restrictions")}
          name="restrictions"
          value={draft.restrictions}
          rows={3}
          maxLength={CAMPAIGN_RESTRICTIONS_MAX_LENGTH}
          counterText={counter}
          onChange={(value) => change("restrictions", value)}
          {...texts(
            "restrictions",
            "public",
            t("fields.restrictions.label"),
            t("fields.restrictions.help"),
            [draft.restrictions],
          )}
        />
        <YesNoField
          id={controlIdOf("productIsSent")}
          name="productIsSent"
          value={draft.productIsSent}
          yesLabel={tBrand("field.yes")}
          noLabel={tBrand("field.no")}
          onChange={(answer) => change("productIsSent", answer)}
          {...texts("productIsSent", "public", t("fields.productIsSent.label"))}
        />
        {draft.productIsSent === true ? (
          <>
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
            <SingleChoiceField
              id={controlIdOf("productValueBand")}
              name="productValueBand"
              options={bands}
              value={draft.productValueBand}
              placeholder={tBrand("field.choose")}
              disabled={draft.currency === null}
              onChange={(code) => change("productValueBand", code)}
              {...texts(
                "productValueBand",
                "internal",
                t("fields.productValueBand.label"),
                t("fields.productValueBand.help"),
              )}
            />
            <YesNoField
              id={controlIdOf("creatorKeepsProduct")}
              name="creatorKeepsProduct"
              value={draft.creatorKeepsProduct}
              yesLabel={tBrand("field.yes")}
              noLabel={tBrand("field.no")}
              onChange={(answer) => change("creatorKeepsProduct", answer)}
              {...texts(
                "creatorKeepsProduct",
                "public",
                t("fields.creatorKeepsProduct.label"),
                t("fields.creatorKeepsProduct.help"),
              )}
            />
            <SingleChoiceField
              id={controlIdOf("shippingCostsBorneBy")}
              name="shippingCostsBorneBy"
              display="radios"
              options={options.shippingPayers}
              value={draft.shippingCostsBorneBy}
              onChange={(code) => change("shippingCostsBorneBy", code)}
              {...texts(
                "shippingCostsBorneBy",
                "public",
                t("fields.shippingCostsBorneBy.label"),
              )}
            />
          </>
        ) : null}
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
          {t("form.internalNotice")}
        </Notice>
        <TextField
          id={controlIdOf("internalReference")}
          name="internalReference"
          value={draft.internalReference}
          maxLength={CAMPAIGN_INTERNAL_REFERENCE_MAX_LENGTH}
          onChange={(value) => change("internalReference", value)}
          {...texts(
            "internalReference",
            "internal",
            t("fields.internalReference.label"),
            t("fields.internalReference.help"),
          )}
        />
      </section>
    </>
  );
}
