"use client";

// The fields of blocks 1 and 2 of "mon profil" (creator; docs/mvp/17 §5.2; 07 RG23 to RG40, RG112):
// each field says whether it is required, who sees it (the layer, icon and text, never the codes
// A, I, N), what it holds, and points to its error. They only display the draft and report a change:
// the rules (caps, lists, patch) are the API's and creator-profile-view.ts. No photo, no avatar, no
// age, no gender of the creator is asked (RG29, RG40); no amount, rate, net or price (D78).
import {
  CREATOR_BIO_MAX_LENGTH,
  CREATOR_CONTACT_EMAIL_MAX_LENGTH,
  CREATOR_HEADLINE_MAX_LENGTH,
  CREATOR_IDENTITY_NAME_MAX_LENGTH,
  CREATOR_PROFILE_LIST_LIMITS,
  type CreatorProfileResponse,
} from "@influx/contracts/creator-profile";
import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { LayerBadge } from "@/components/member/ui/LayerBadge";
import { MultiChoiceField } from "@/components/member/ui/MultiChoiceField";
import { Notice } from "@/components/member/ui/Notice";
import { PickListField } from "@/components/member/ui/PickListField";
import { SingleChoiceField } from "@/components/member/ui/SingleChoiceField";
import { TextAreaField } from "@/components/member/ui/TextAreaField";
import { TextField } from "@/components/member/ui/TextField";
import { MEMBER_FIELD_HELP_CLASSES } from "@/components/member/ui/field-classes";
import type { ProfileLayer } from "@/components/member/ui/layer-badge-classes";
import { countCharacters } from "@/components/member/ui/text-limits";
import { getLocalizedCountryOptions } from "@/content/country-codes";
import { Link } from "@/i18n/navigation";
import { memberPageHref } from "@/lib/member-paths";
import type { CreatorProfileOptions } from "./creator-profile-options";
import {
  controlIdOf,
  hasTextWarning,
  type CreatorDraft,
  type DraftKey,
  type FieldErrors,
} from "./creator-profile-view";

export type CreatorFieldsProps = {
  profile: CreatorProfileResponse;
  draft: CreatorDraft;
  errors: FieldErrors;
  options: CreatorProfileOptions;
  change: <Key extends DraftKey>(key: Key, value: CreatorDraft[Key]) => void;
};

/** The fields of the form flagged "required" in the writing (07 RG4, Q15). */
const REQUIRED_KEYS: ReadonlySet<DraftKey> = new Set<DraftKey>([
  "headline",
  "bio",
  "primaryTopic",
  "publicationLanguages",
]);

/** The texts every field shares, from its key: label, required, layer, error. */
function useFieldTexts(errors: FieldErrors) {
  const t = useTranslations("creatorProfile");
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
    error: errors[key] === undefined ? undefined : t(`issues.${errors[key]}`),
  });
}

/** The caps of a list, said before any choice and counted after (a limit is told, not discovered). */
function useListTexts() {
  const t = useTranslations("creatorProfile");
  return (selected: number, max: number) => ({
    max,
    limitText: t("field.limit", { max }),
    countText: t("field.count", { count: selected, max }),
    limitReachedText: t("field.limitReached"),
  });
}

/**
 * The alias before any entry (17 §5.2): the most counter-intuitive screen of the product asks a
 * creator not to name themselves, so the explanation comes first (07 RG23, RG24).
 */
function AliasNotice({ alias }: { alias: string | null }) {
  const t = useTranslations("creatorProfile");
  if (alias === null) {
    return (
      <Notice tone="info" announce={false}>
        {t("alias.none")}
      </Notice>
    );
  }
  return (
    <Notice tone="info" announce={false}>
      <div className="flex flex-col gap-2">
        <p className="font-semibold text-text-primary">
          {t("alias.explain", { alias: t("alias.name", { alias }) })}
        </p>
        <p>{t("alias.reveal")}</p>
        <p>{t("alias.forLife")}</p>
      </div>
    </Notice>
  );
}

/** The warning of the detection under a public text (07 RG27): never blocking, the moderator decides. */
function TextWarning({ shown }: { shown: boolean }) {
  const t = useTranslations("creatorProfile");
  return shown ? (
    <Notice tone="warning">{t("errors.identifierInText")}</Notice>
  ) : null;
}

/** Block 1, presentation (07 RG23 to RG32): alias, short title, bio, then what only the creator and the team see. */
export function PresentationFields({
  profile,
  draft,
  errors,
  options,
  change,
}: CreatorFieldsProps) {
  const t = useTranslations("creatorProfile");
  const texts = useFieldTexts(errors);
  const characters = (count: number, max: number) =>
    t("field.characters", { count, max });
  return (
    <>
      <AliasNotice alias={profile.alias} />
      <TextField
        id={controlIdOf("headline")}
        name="headline"
        value={draft.headline}
        maxLength={CREATOR_HEADLINE_MAX_LENGTH}
        onChange={(value) => change("headline", value)}
        {...texts(
          "headline",
          "public",
          t("fields.headline.label"),
          `${t("fields.headline.help")} ${characters(
            countCharacters(draft.headline),
            CREATOR_HEADLINE_MAX_LENGTH,
          )}`,
        )}
      />
      <TextWarning shown={hasTextWarning("headline", profile.warnings)} />
      <TextAreaField
        id={controlIdOf("bio")}
        name="bio"
        rows={8}
        value={draft.bio}
        maxLength={CREATOR_BIO_MAX_LENGTH}
        counterText={characters}
        onChange={(value) => change("bio", value)}
        {...texts("bio", "public", t("fields.bio.label"), t("fields.bio.help"))}
      />
      <TextWarning shown={hasTextWarning("bio", profile.warnings)} />
      <SingleChoiceField
        id={controlIdOf("collaborationExperience")}
        name="collaborationExperience"
        display="radios"
        options={options.experiences}
        value={draft.collaborationExperience}
        onChange={(code) => change("collaborationExperience", code)}
        {...texts(
          "collaborationExperience",
          "public",
          t("fields.collaborationExperience.label"),
          t("fields.collaborationExperience.help"),
        )}
      />
      <TextField
        id={controlIdOf("legalFirstName")}
        name="legalFirstName"
        value={draft.legalFirstName}
        maxLength={CREATOR_IDENTITY_NAME_MAX_LENGTH}
        autoComplete="given-name"
        onChange={(value) => change("legalFirstName", value)}
        {...texts(
          "legalFirstName",
          "internal",
          t("fields.legalFirstName.label"),
        )}
      />
      <TextField
        id={controlIdOf("legalLastName")}
        name="legalLastName"
        value={draft.legalLastName}
        maxLength={CREATOR_IDENTITY_NAME_MAX_LENGTH}
        autoComplete="family-name"
        onChange={(value) => change("legalLastName", value)}
        {...texts("legalLastName", "internal", t("fields.legalLastName.label"))}
      />
      <TextField
        id={controlIdOf("contactPhone")}
        name="contactPhone"
        type="tel"
        value={draft.contactPhone}
        maxLength={16}
        autoComplete="tel"
        onChange={(value) => change("contactPhone", value)}
        {...texts(
          "contactPhone",
          "internal",
          t("fields.contactPhone.label"),
          t("fields.contactPhone.help"),
        )}
      />
      <TextField
        id={controlIdOf("contactEmail")}
        name="contactEmail"
        type="email"
        value={draft.contactEmail}
        maxLength={CREATOR_CONTACT_EMAIL_MAX_LENGTH}
        onChange={(value) => change("contactEmail", value)}
        {...texts(
          "contactEmail",
          "internal",
          t("fields.contactEmail.label"),
          t("fields.contactEmail.help"),
        )}
      />
    </>
  );
}

/** A value of the account shown, not asked again (07 RG2, CA2): its layer, its value, the way to change it. */
function AccountValue({
  layer,
  label,
  help,
  value,
  children,
}: {
  layer: ProfileLayer;
  label: string;
  help?: string;
  value: string;
  children?: ReactNode;
}) {
  const t = useTranslations("creatorProfile");
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-semibold text-text-primary">{label}</span>
        <LayerBadge layer={layer} label={t(`layer.${layer}`)} />
      </div>
      <p className="text-md text-text-primary">{value}</p>
      {help === undefined ? null : (
        <p className={MEMBER_FIELD_HELP_CLASSES}>{help}</p>
      )}
      {children}
    </div>
  );
}

/** Block 2, editorial line and situation (07 RG33 to RG40). Region and address are not asked at L2D. */
export function EditorialFields({
  profile,
  draft,
  errors,
  options,
  change,
}: CreatorFieldsProps) {
  const t = useTranslations("creatorProfile");
  const locale = useLocale();
  const texts = useFieldTexts(errors);
  const listTexts = useListTexts();
  const limits = CREATOR_PROFILE_LIST_LIMITS;
  const country =
    getLocalizedCountryOptions(locale).find(
      (option) => option.code === profile.residenceCountry,
    )?.name ?? profile.residenceCountry;
  const language =
    options.languages.find(
      (option) => option.code === profile.preferredLanguage,
    )?.label ?? profile.preferredLanguage;
  // The main topic is not repeated among the secondary ones (07 RG33).
  const secondaryOptions = options.topics.filter(
    (option) => option.code !== draft.primaryTopic,
  );
  return (
    <>
      <SingleChoiceField
        id={controlIdOf("primaryTopic")}
        name="primaryTopic"
        options={options.topics}
        value={draft.primaryTopic}
        placeholder={t("field.choose")}
        onChange={(code) => change("primaryTopic", code)}
        {...texts("primaryTopic", "public", t("fields.primaryTopic.label"))}
      />
      <PickListField
        id={controlIdOf("secondaryTopics")}
        name="secondaryTopics"
        options={secondaryOptions}
        value={draft.secondaryTopics}
        {...listTexts(draft.secondaryTopics.length, limits.secondaryTopics)}
        addLabel={t("field.addTopic")}
        listLabel={t("field.selected")}
        removeLabel={(label) => t("field.remove", { label })}
        onChange={(codes) => change("secondaryTopics", codes)}
        {...texts(
          "secondaryTopics",
          "public",
          t("fields.secondaryTopics.label"),
        )}
      />
      <MultiChoiceField
        id={controlIdOf("tones")}
        options={options.tones}
        value={draft.tones}
        {...listTexts(draft.tones.length, limits.tones)}
        onChange={(codes) => change("tones", codes)}
        {...texts("tones", "public", t("fields.tones.label"))}
      />
      <PickListField
        id={controlIdOf("publicationLanguages")}
        name="publicationLanguages"
        options={options.languages}
        value={draft.publicationLanguages}
        {...listTexts(
          draft.publicationLanguages.length,
          limits.publicationLanguages,
        )}
        addLabel={t("field.addLanguage")}
        listLabel={t("field.selected")}
        removeLabel={(label) => t("field.remove", { label })}
        onChange={(codes) => change("publicationLanguages", codes)}
        {...texts(
          "publicationLanguages",
          "public",
          t("fields.publicationLanguages.label"),
        )}
      />
      <AccountValue
        layer="public"
        label={t("fields.residenceCountry.label")}
        help={t("fields.residenceCountry.help")}
        value={country}
      >
        <Link
          href={memberPageHref("accountDetails", locale)}
          className="text-sm font-semibold text-text-brand-strong underline underline-offset-2"
        >
          {t("fields.residenceCountry.change")}
        </Link>
      </AccountValue>
      <AccountValue
        layer="internal"
        label={t("fields.accountLanguage.label")}
        value={language}
      />
      <SingleChoiceField
        id={controlIdOf("travelScope")}
        name="travelScope"
        display="radios"
        options={options.travelScopes}
        value={draft.travelScope}
        onChange={(code) => change("travelScope", code)}
        {...texts("travelScope", "public", t("fields.travelScope.label"))}
      />
      <TextField
        id={controlIdOf("city")}
        name="city"
        value={draft.city}
        maxLength={CREATOR_IDENTITY_NAME_MAX_LENGTH}
        autoComplete="address-level2"
        onChange={(value) => change("city", value)}
        {...texts(
          "city",
          "internal",
          t("fields.city.label"),
          t("fields.city.help"),
        )}
      />
    </>
  );
}
