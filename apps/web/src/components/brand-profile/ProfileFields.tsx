"use client";

// The fields of the three blocks of "mon profil de marque" (docs/mvp/17 §4.2; 06 RG15, RG27, RG35,
// RG62, RG85): each field says it is required or not, who sees it (the layer, icon and text), what
// it holds, and points to its error. They only display the draft and report a change: the rules
// (caps, lists, domain, patch) are the API's and brand-profile-view.ts. Budget, logo and badge are
// not here (D48, D78: suspended; the badge is L2E); the logo is LogoField.tsx (commit 12).
import {
  BRAND_PROFILE_LIST_LIMITS,
  CONTACT_FIRST_NAME_MAX_LENGTH,
  CONTACT_EMAIL_MAX_LENGTH,
  CONTACT_URL_MAX_LENGTH,
  PRESENTATION_MAX_LENGTH,
  WEBSITE_INPUT_MAX_LENGTH,
  type BrandProfileResponse,
} from "@influx/contracts/brand-profile";
import { useLocale, useTranslations } from "next-intl";
import { DomainField } from "@/components/member/ui/DomainField";
import { LayerBadge } from "@/components/member/ui/LayerBadge";
import { MultiChoiceField } from "@/components/member/ui/MultiChoiceField";
import { Notice } from "@/components/member/ui/Notice";
import { PickListField } from "@/components/member/ui/PickListField";
import { SingleChoiceField } from "@/components/member/ui/SingleChoiceField";
import { TextAreaField } from "@/components/member/ui/TextAreaField";
import { TextField } from "@/components/member/ui/TextField";
import { YesNoField } from "@/components/member/ui/YesNoField";
import { MEMBER_FIELD_HELP_CLASSES } from "@/components/member/ui/field-classes";
import type { ProfileLayer } from "@/components/member/ui/layer-badge-classes";
import { getLocalizedCountryOptions } from "@/content/country-codes";
import {
  controlIdOf,
  controlIdOfRequired,
  REQUIRED_KEYS,
  type BrandDraft,
  type DraftKey,
  type FieldErrors,
} from "./brand-profile-view";
import type { ProfileOptions } from "./brand-profile-options";
import { LogoField } from "./LogoField";
import type { BrandLogoState } from "./use-brand-logo";

export type FieldsProps = {
  profile: BrandProfileResponse;
  draft: BrandDraft;
  errors: FieldErrors;
  options: ProfileOptions;
  change: <Key extends DraftKey>(key: Key, value: BrandDraft[Key]) => void;
  /** The domain kept when the website typed was longer (CA4). */
  websiteDomain: string | null;
};

/** The texts every field shares, from its key: label, required, layer, error (RG85). */
function useFieldTexts(errors: FieldErrors) {
  const t = useTranslations("brandProfile");
  return (
    key: DraftKey,
    layer: ProfileLayer,
    label: string,
    help?: string,
  ) => ({
    label,
    requiredLabel: REQUIRED_KEYS.has(key) ? t("field.required") : undefined,
    layer: { layer, label: t(`layer.${layer}`) },
    help,
    error:
      errors[key] === undefined ? undefined : t(`fieldErrors.${errors[key]}`),
  });
}

/** Block 1, public identity (06 RG15). The logo has its own deposit, outside the autosave. */
export function IdentityFields({
  profile,
  draft,
  errors,
  options,
  change,
  websiteDomain,
  logo,
}: FieldsProps & { logo: BrandLogoState }) {
  const t = useTranslations("brandProfile");
  const locale = useLocale();
  const texts = useFieldTexts(errors);
  const country =
    getLocalizedCountryOptions(locale).find(
      (option) => option.code === profile.country,
    )?.name ?? profile.country;
  return (
    <>
      <LogoField logo={logo} />
      <TextField
        id={controlIdOfRequired("legalName")}
        name="companyName"
        value={draft.companyName}
        maxLength={120}
        autoComplete="organization"
        onChange={(value) => change("companyName", value)}
        {...texts(
          "companyName",
          "public",
          t("fields.companyName.label"),
          t("fields.companyName.help"),
        )}
      />
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-semibold text-text-primary">
            {t("fields.country.label")}
          </span>
          <LayerBadge layer="public" label={t("layer.public")} />
        </div>
        <p className="text-md text-text-primary">{country}</p>
        <p className={MEMBER_FIELD_HELP_CLASSES}>{t("fields.country.help")}</p>
      </div>
      <SingleChoiceField
        id={controlIdOfRequired("primarySector")}
        name="primarySector"
        options={options.sectors}
        value={draft.primarySector}
        placeholder={t("field.choose")}
        onChange={(code) => change("primarySector", code)}
        {...texts("primarySector", "public", t("fields.primarySector.label"))}
      />
      <PickListField
        id={controlIdOf("secondarySectors")}
        name="secondarySectors"
        options={options.sectors}
        value={draft.secondarySectors}
        max={BRAND_PROFILE_LIST_LIMITS.secondarySectors}
        limitText={t("field.limit", {
          max: BRAND_PROFILE_LIST_LIMITS.secondarySectors,
        })}
        countText={t("field.count", {
          count: draft.secondarySectors.length,
          max: BRAND_PROFILE_LIST_LIMITS.secondarySectors,
        })}
        limitReachedText={t("field.limitReached")}
        addLabel={t("field.addOne")}
        listLabel={t("field.selected")}
        removeLabel={(label) => t("field.remove", { label })}
        onChange={(codes) => change("secondarySectors", codes)}
        {...texts(
          "secondarySectors",
          "public",
          t("fields.secondarySectors.label"),
        )}
      />
      <SingleChoiceField
        id={controlIdOfRequired("companySize")}
        name="companySize"
        display="radios"
        options={options.companySizes}
        value={draft.companySize}
        onChange={(code) => change("companySize", code)}
        {...texts("companySize", "public", t("fields.companySize.label"))}
      />
      <PickListField
        id={controlIdOfRequired("targetMarkets")}
        name="targetMarkets"
        options={options.countries}
        value={draft.targetMarkets}
        max={BRAND_PROFILE_LIST_LIMITS.targetMarkets}
        limitText={t("field.limit", {
          max: BRAND_PROFILE_LIST_LIMITS.targetMarkets,
        })}
        countText={t("field.count", {
          count: draft.targetMarkets.length,
          max: BRAND_PROFILE_LIST_LIMITS.targetMarkets,
        })}
        limitReachedText={t("field.limitReached")}
        addLabel={t("field.add")}
        listLabel={t("field.selected")}
        removeLabel={(label) => t("field.remove", { label })}
        onChange={(codes) => change("targetMarkets", codes)}
        {...texts("targetMarkets", "public", t("fields.targetMarkets.label"))}
      />
      <MultiChoiceField
        id={controlIdOfRequired("workingLanguages")}
        options={options.languages}
        value={draft.workingLanguages}
        max={BRAND_PROFILE_LIST_LIMITS.workingLanguages}
        limitText={t("field.limit", {
          max: BRAND_PROFILE_LIST_LIMITS.workingLanguages,
        })}
        countText={t("field.count", {
          count: draft.workingLanguages.length,
          max: BRAND_PROFILE_LIST_LIMITS.workingLanguages,
        })}
        limitReachedText={t("field.limitReached")}
        onChange={(codes) => change("workingLanguages", codes)}
        {...texts(
          "workingLanguages",
          "public",
          t("fields.workingLanguages.label"),
        )}
      />
      <DomainField
        id={controlIdOf("website")}
        name="website"
        value={draft.website}
        maxLength={WEBSITE_INPUT_MAX_LENGTH}
        placeholder={t("fields.website.placeholder")}
        onChange={(value) => change("website", value)}
        notice={
          websiteDomain === null ? undefined : (
            <Notice tone="info">
              {t("website.normalized", { domain: websiteDomain })}
            </Notice>
          )
        }
        {...texts("website", "public", t("fields.website.label"))}
      />
      <TextAreaField
        id={controlIdOfRequired("presentation")}
        name="presentation"
        value={draft.presentation}
        maxLength={PRESENTATION_MAX_LENGTH}
        counterText={(count, max) => t("field.characters", { count, max })}
        onChange={(value) => change("presentation", value)}
        {...texts(
          "presentation",
          "public",
          t("fields.presentation.label"),
          `${t("fields.presentation.help")} ${t("fields.presentation.hint")}`,
        )}
      />
    </>
  );
}

/** Block 2, what the brand looks for (06 RG27). The indicative budget is not asked (D48, D78). */
export function ExpectationFields({
  draft,
  errors,
  options,
  change,
}: FieldsProps) {
  const t = useTranslations("brandProfile");
  const texts = useFieldTexts(errors);
  const limits = BRAND_PROFILE_LIST_LIMITS;
  return (
    <>
      <MultiChoiceField
        id={controlIdOfRequired("topics")}
        options={options.topics}
        value={draft.topics}
        max={limits.topics}
        limitText={t("field.limit", { max: limits.topics })}
        countText={t("field.count", {
          count: draft.topics.length,
          max: limits.topics,
        })}
        limitReachedText={t("field.limitReached")}
        onChange={(codes) => change("topics", codes)}
        {...texts("topics", "public", t("fields.topics.label"))}
      />
      <MultiChoiceField
        id={controlIdOfRequired("networks")}
        options={options.networks}
        value={draft.networks}
        max={limits.networks}
        limitText={t("field.limitFree")}
        countText={t("field.chosen", { count: draft.networks.length })}
        limitReachedText={t("field.limitReached")}
        onChange={(codes) => change("networks", codes)}
        {...texts("networks", "public", t("fields.networks.label"))}
      />
      <MultiChoiceField
        id={controlIdOfRequired("formats")}
        options={options.formats}
        value={draft.formats}
        max={limits.formats}
        limitText={t("field.limitFree")}
        countText={t("field.chosen", { count: draft.formats.length })}
        limitReachedText={t("field.limitReached")}
        onChange={(codes) => change("formats", codes)}
        {...texts("formats", "public", t("fields.formats.label"))}
      />
      <MultiChoiceField
        id={controlIdOf("usageRights")}
        options={options.usageRights}
        value={draft.usageRights}
        max={limits.usageRights}
        limitText={t("field.limitFree")}
        countText={t("field.chosen", { count: draft.usageRights.length })}
        limitReachedText={t("field.limitReached")}
        onChange={(codes) => change("usageRights", codes)}
        {...texts("usageRights", "public", t("fields.usageRights.label"))}
      />
      <SingleChoiceField
        id={controlIdOf("exclusivityBand")}
        name="exclusivityBand"
        options={options.exclusivities}
        value={draft.exclusivityBand}
        placeholder={t("field.choose")}
        onChange={(code) => change("exclusivityBand", code)}
        {...texts(
          "exclusivityBand",
          "public",
          t("fields.exclusivityBand.label"),
        )}
      />
      <YesNoField
        id={controlIdOf("offersNonMonetary")}
        name="offersNonMonetary"
        value={draft.offersNonMonetary}
        yesLabel={t("field.yes")}
        noLabel={t("field.no")}
        onChange={(answer) => change("offersNonMonetary", answer)}
        {...texts(
          "offersNonMonetary",
          "public",
          t("fields.offersNonMonetary.label"),
        )}
      />
      <PickListField
        id={controlIdOfRequired("audienceCountries")}
        name="audienceCountries"
        options={options.countries}
        value={draft.audienceCountries}
        max={limits.audienceCountries}
        limitText={t("field.limit", { max: limits.audienceCountries })}
        countText={t("field.count", {
          count: draft.audienceCountries.length,
          max: limits.audienceCountries,
        })}
        limitReachedText={t("field.limitReached")}
        addLabel={t("field.add")}
        listLabel={t("field.selected")}
        removeLabel={(label) => t("field.remove", { label })}
        onChange={(codes) => change("audienceCountries", codes)}
        {...texts(
          "audienceCountries",
          "public",
          t("fields.audienceCountries.label"),
        )}
      />
      <SingleChoiceField
        id={controlIdOf("collaborationRhythm")}
        name="collaborationRhythm"
        options={options.rhythms}
        value={draft.collaborationRhythm}
        placeholder={t("field.choose")}
        onChange={(code) => change("collaborationRhythm", code)}
        {...texts(
          "collaborationRhythm",
          "public",
          t("fields.collaborationRhythm.label"),
        )}
      />
    </>
  );
}

/** Block 3, the contact person (06 RG35, D46): the role is public, the first name revealed, the rest internal. */
export function ContactFields({
  profile,
  draft,
  errors,
  options,
  change,
}: FieldsProps) {
  const t = useTranslations("brandProfile");
  const texts = useFieldTexts(errors);
  return (
    <>
      <SingleChoiceField
        id={controlIdOfRequired("contactRole")}
        name="contactRole"
        options={options.contactRoles}
        value={draft.contactRole}
        placeholder={t("field.choose")}
        onChange={(code) => change("contactRole", code)}
        {...texts("contactRole", "public", t("fields.contactRole.label"))}
      />
      <Notice tone="info" announce={false}>
        {t("contactBlock.notice")}
      </Notice>
      <TextField
        id={controlIdOf("contactFirstName")}
        name="contactFirstName"
        value={draft.contactFirstName}
        maxLength={CONTACT_FIRST_NAME_MAX_LENGTH}
        onChange={(value) => change("contactFirstName", value)}
        {...texts(
          "contactFirstName",
          "revealed",
          t("fields.contactFirstName.label"),
        )}
      />
      <TextField
        id={controlIdOf("contactEmail")}
        name="contactEmail"
        type="email"
        value={draft.contactEmail}
        maxLength={CONTACT_EMAIL_MAX_LENGTH}
        placeholder={profile.signInEmail}
        onChange={(value) => change("contactEmail", value)}
        {...texts(
          "contactEmail",
          "internal",
          t("fields.contactEmail.label"),
          t("fields.contactEmail.help"),
        )}
      />
      <TextField
        id={controlIdOf("contactPhone")}
        name="contactPhone"
        type="tel"
        value={draft.contactPhone}
        maxLength={16}
        onChange={(value) => change("contactPhone", value)}
        {...texts(
          "contactPhone",
          "internal",
          t("fields.contactPhone.label"),
          t("fields.contactPhone.help"),
        )}
      />
      <TextField
        id={controlIdOf("contactUrl")}
        name="contactUrl"
        type="url"
        value={draft.contactUrl}
        maxLength={CONTACT_URL_MAX_LENGTH}
        onChange={(value) => change("contactUrl", value)}
        {...texts(
          "contactUrl",
          "internal",
          t("fields.contactUrl.label"),
          t("fields.contactUrl.help"),
        )}
      />
    </>
  );
}
