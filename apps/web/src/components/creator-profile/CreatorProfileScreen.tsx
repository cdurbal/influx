"use client";

// "Mon profil" of a creator (docs/mvp/17 §5.2, C2; 07 RG1, RG86 to RG91, RG111, RG112; jalons/l2d,
// commit 12): a summary of five sections whose anchors work at every width, blocks 1 and 2 saved by
// themselves, the completeness and what is still to fill in by name in a sticky column. There is no
// submit button and the screen never speaks of publication: the portfolio and the badge do not exist
// yet (L2E, L2G), so the score counts only what the creator typed (EC-L2D-5). Blocks 3 to 5 arrive
// with the next commits and are told "coming soon" in the summary. This file draws; the state is
// use-creator-profile.ts, the rules creator-profile-view.ts and apps/api. The page of a creator: a
// brand reaches its own screen, whatever the address. No amount, rate, net or price (D78, D48).
// Blocks 4 (audience) and 5 (offer, with no tariff) came with commit 14: all five sections are built.
import { notFound } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, type ReactNode } from "react";
import { useOnline } from "@/components/auth/use-online";
import {
  BACK_ICON_CLASSES,
  BACK_LINK_CLASSES,
} from "@/components/account/account-classes";
import {
  ACTION_BAR_CLASSES,
  PROFILE_CARD_CLASSES,
  PROFILE_PAGE_CLASSES,
  SAVE_STATUS_CLASSES,
  SECTION_FIELDSET_CLASSES,
  SECTION_TITLE_CLASSES,
} from "@/components/brand-profile/brand-profile-classes";
import { formatSavedTime } from "@/components/brand-profile/brand-profile-view";
import type { SaveState } from "@/components/brand-profile/use-brand-profile";
import { useMember } from "@/components/member/member-context";
import { MemberButton } from "@/components/member/ui/MemberButton";
import { Notice } from "@/components/member/ui/Notice";
import { PageBackContext, PageHeader } from "@/components/member/ui/PageHeader";
import { ScoreGauge } from "@/components/member/ui/ScoreGauge";
import { cn } from "@/components/ui/class-names";
import { ErrorNotice } from "@/components/ui/ErrorNotice";
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  CheckIcon,
  CircleAlertIcon,
} from "@/components/ui/icons";
import { Link } from "@/i18n/navigation";
import { memberPageHref } from "@/lib/member-paths";
import { FOLD_SUMMARY_CLASSES } from "./creator-profile-classes";
import { AudienceFields } from "./CreatorAudienceFields";
import { NetworksFields } from "./CreatorNetworksFields";
import { OfferFields } from "./CreatorOfferFields";
import {
  EditorialFields,
  PresentationFields,
  type CreatorFieldsProps,
} from "./CreatorProfileFields";
import {
  bandLabelOf,
  creatorOptionsOf,
  networkOptionsOf,
} from "./creator-profile-options";
import {
  BUILT_SECTIONS,
  creatorSummaryOf,
  SECTION_IDS,
  isEditable,
  isSectionComplete,
  sectionAnchorOf,
  type RequiredCode,
  type SectionId,
} from "./creator-profile-view";
import { useCreatorAudience } from "./use-creator-audience";
import { useCreatorNetworks } from "./use-creator-networks";
import {
  useCreatorProfile,
  type CreatorProfileState,
} from "./use-creator-profile";

/** The three columns of a wide screen: the summary, the form, the completeness (17 §5.2). */
const GRID_CLASSES =
  "flex flex-col gap-6 lg:grid lg:grid-cols-(--grid-creator-profile) lg:items-start lg:gap-6 xl:gap-8";
const SUMMARY_CLASSES =
  "flex flex-col gap-3 lg:col-start-1 lg:row-start-1 lg:sticky lg:top-(--spacing-6)";
const FORM_CLASSES = "flex flex-col gap-6 lg:col-start-2 lg:row-start-1";
const PROGRESS_CLASSES =
  "flex flex-col gap-4 lg:col-start-3 lg:row-start-1 lg:sticky lg:top-(--spacing-6)";
const SECTION_CLASSES = cn(PROFILE_CARD_CLASSES, "scroll-mt-(--spacing-6)");
/** From lg the state always sits under the title, so that the summary column can stay narrow. */
const SUMMARY_LINK_CLASSES =
  "flex min-h-(--size-touch-target) flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-md px-3 py-2 text-text-primary hover:bg-surface-raised lg:flex-col lg:flex-nowrap lg:items-start lg:justify-start";
const SUMMARY_STATE_CLASSES =
  "inline-flex items-center gap-1 text-sm text-text-secondary";

/** The page of a creator; any other role finds a page that does not exist (18 T14.3, T14.4). */
export function CreatorProfileScreen() {
  const { me } = useMember();
  if (me.role !== "creator") {
    notFound();
  }
  return <CreatorProfileView />;
}

function CreatorProfileView() {
  const t = useTranslations("creatorProfile");
  const tAccount = useTranslations("account");
  const locale = useLocale();
  const online = useOnline();
  const { signedOut, creatorProfile } = useMember();
  const { adopt } = creatorProfile;
  const state = useCreatorProfile({ onSignedOut: () => signedOut(null) });
  // Each profile the API gives goes to the shell too: its column and the home write the same state.
  const held = state.profile;
  useEffect(() => {
    if (held !== null) {
      adopt(creatorSummaryOf(held));
    }
  }, [held, adopt]);

  const back = (
    <Link
      href={memberPageHref("accountHub", locale)}
      className={BACK_LINK_CLASSES}
    >
      <span className="sr-only">{tAccount("hub.backPrefix")} </span>
      <ChevronLeftIcon aria-hidden="true" className={BACK_ICON_CLASSES} />
      {tAccount("hub.back")}
    </Link>
  );

  const { phase, profile, draft } = state;
  if (phase === "gone") {
    notFound();
  }

  let body: ReactNode;
  if (phase === "loading" || profile === null || draft === null) {
    body =
      phase === "unavailable" ? (
        <div className="flex flex-col gap-4">
          <ErrorNotice>{t("page.unavailable")}</ErrorNotice>
          <MemberButton variant="secondary" onClick={state.reload}>
            {t("page.retry")}
          </MemberButton>
        </div>
      ) : (
        <p role="status" className="text-sm text-text-secondary">
          {t("page.loading")}
        </p>
      );
  } else {
    body = (
      <LoadedProfile
        state={state}
        profile={profile}
        draft={draft}
        locale={locale}
      />
    );
  }

  return (
    <PageBackContext value={back}>
      <div className={PROFILE_PAGE_CLASSES}>
        {online ? null : <Notice tone="warning">{tAccount("offline")}</Notice>}
        <PageHeader title={t("page.title")} />
        {body}
      </div>
    </PageBackContext>
  );
}

function LoadedProfile({
  state,
  profile,
  draft,
  locale,
}: {
  state: CreatorProfileState;
  profile: NonNullable<CreatorProfileState["profile"]>;
  draft: NonNullable<CreatorProfileState["draft"]>;
  locale: string;
}) {
  const t = useTranslations("creatorProfile");
  const tBrand = useTranslations("brandProfile");
  const options = useMemo(
    () => creatorOptionsOf(t, tBrand, locale, profile.references),
    [t, tBrand, locale, profile.references],
  );
  const { signedOut } = useMember();
  const networkOptions = useMemo(
    () => networkOptionsOf(tBrand, profile.references),
    [tBrand, profile.references],
  );
  const networks = useCreatorNetworks({
    onSignedOut: () => signedOut(null),
    report: state.reportSave,
    onProgress: state.applyProgress,
  });
  const audience = useCreatorAudience({
    networks,
    onSignedOut: () => signedOut(null),
    report: state.reportSave,
  });
  const editable = isEditable(profile);
  const labelOf = (code: string) =>
    networkOptions.find((option) => option.code === code)?.label ?? code;
  const fields: CreatorFieldsProps = {
    profile,
    draft,
    errors: state.fieldErrors,
    options,
    change: state.change,
  };

  return (
    <>
      {profile.alias === null ? (
        <Notice tone="info">{t("page.noStorefront")}</Notice>
      ) : null}
      <div className={GRID_CLASSES}>
        <aside className={PROGRESS_CLASSES}>
          <ProfileProgress
            profile={profile}
            save={state.save}
            locale={locale}
          />
        </aside>
        <Summary missing={profile.missingRequired} />
        <div className={FORM_CLASSES}>
          <ProfileSection id="presentation" disabled={!editable}>
            <PresentationFields {...fields} />
          </ProfileSection>
          <ProfileSection id="editorial" disabled={!editable}>
            <EditorialFields {...fields} />
          </ProfileSection>
          <ProfileSection id="networks" disabled={!editable}>
            <NetworksFields
              state={networks}
              networks={networkOptions}
              labelOf={labelOf}
              bandLabelOf={(group, code) => bandLabelOf(t, group, code)}
            />
          </ProfileSection>
          <ProfileSection id="audience" disabled={!editable}>
            <AudienceFields
              networks={networks}
              audience={audience}
              labelOf={labelOf}
            />
          </ProfileSection>
          <ProfileSection id="offer" disabled={!editable}>
            <OfferFields
              {...fields}
              networkCodes={
                networks.phase === "ready"
                  ? new Set(networks.lines.map((line) => line.networkCode))
                  : null
              }
            />
          </ProfileSection>
        </div>
      </div>
      <div data-action-bar="" className={ACTION_BAR_CLASSES}>
        <SaveStatus save={state.save} locale={locale} />
      </div>
    </>
  );
}

/** The five sections and where each stands, as anchors (17 §5.2): text AND icon, never the icon alone. */
function Summary({ missing }: { missing: readonly RequiredCode[] }) {
  const t = useTranslations("creatorProfile");
  return (
    <nav aria-label={t("summary.title")} className={SUMMARY_CLASSES}>
      <ol className="flex flex-col gap-1">
        {SECTION_IDS.map((id, index) => {
          const name = `${index + 1}. ${t(`sections.${id}`)}`;
          if (!BUILT_SECTIONS.has(id)) {
            return (
              <li
                key={id}
                className={cn(SUMMARY_LINK_CLASSES, "hover:bg-transparent")}
              >
                <span className="text-text-secondary">{name}</span>
                <span className={SUMMARY_STATE_CLASSES}>
                  {t("summary.soon")}
                </span>
              </li>
            );
          }
          const complete = isSectionComplete(id, missing);
          const StateIcon = complete ? CheckIcon : CircleAlertIcon;
          return (
            <li key={id}>
              <a
                href={`#${sectionAnchorOf(id)}`}
                className={SUMMARY_LINK_CLASSES}
              >
                <span>{name}</span>
                <span className={SUMMARY_STATE_CLASSES}>
                  <StateIcon
                    aria-hidden="true"
                    className="size-(--size-icon-sm) shrink-0"
                  />
                  {complete ? t("summary.complete") : t("summary.incomplete")}
                </span>
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** A block of the form: a card with its anchor and its title; the fields stop answering when it cannot be edited. */
function ProfileSection({
  id,
  disabled,
  children,
}: {
  id: SectionId;
  disabled: boolean;
  children: ReactNode;
}) {
  const t = useTranslations("creatorProfile");
  const titleId = `${sectionAnchorOf(id)}-title`;
  const heading = `${SECTION_IDS.indexOf(id) + 1}. ${t(`sections.${id}`)}`;
  return (
    <section
      id={sectionAnchorOf(id)}
      aria-labelledby={titleId}
      data-section={id}
      className={SECTION_CLASSES}
    >
      <h2 id={titleId} className={cn(SECTION_TITLE_CLASSES, "mb-5")}>
        {heading}
      </h2>
      <fieldset disabled={disabled} className={SECTION_FIELDSET_CLASSES}>
        {children}
      </fieldset>
    </section>
  );
}

/** The score and what is missing by name (07 RG89, RG90); not a goal, nothing is submitted (EC-L2D-5). */
function ProfileProgress({
  profile,
  save,
  locale,
}: {
  profile: NonNullable<CreatorProfileState["profile"]>;
  save: SaveState;
  locale: string;
}) {
  const t = useTranslations("creatorProfile");
  const missing = profile.missingRequired;
  const names = new Intl.ListFormat(locale, {
    style: "long",
    type: "conjunction",
  }).format(missing.map((code) => t(`required.${code}`)));
  return (
    <div className={PROFILE_CARD_CLASSES}>
      <ScoreGauge
        label={t("completeness.label")}
        value={profile.completeness.score}
        valueText={t("completeness.value", {
          score: profile.completeness.score,
        })}
      />
      {missing.length === 0 ? (
        <p className="text-sm text-text-primary">{t("blocks.allSet")}</p>
      ) : (
        <>
          {/* From lg: the column has the room to name every field (RG90). */}
          <p className="text-sm text-text-primary max-lg:hidden">
            {t("blocks.missing", { fields: names })}
          </p>
          {/* Below lg (L2DU-2): the count, the names behind it, so that the summary and the alias stay in the first screen. */}
          <details className="lg:hidden" data-missing-fold="">
            <summary className={FOLD_SUMMARY_CLASSES}>
              <ChevronDownIcon
                aria-hidden="true"
                className="size-(--size-icon-md) shrink-0 text-text-secondary"
              />
              {t("blocks.missingCount", { count: missing.length })}
            </summary>
            <p className="text-sm text-text-primary">{names}</p>
          </details>
        </>
      )}
      <SaveStatus save={save} locale={locale} className="max-lg:hidden" />
    </div>
  );
}

/** "Enregistré automatiquement à 14 h 07" (RG111), and the retry told when the save failed. */
function SaveStatus({
  save,
  locale,
  className,
}: {
  save: SaveState;
  locale: string;
  className?: string;
}) {
  const t = useTranslations("creatorProfile");
  let text: string;
  switch (save.kind) {
    case "saving":
      text = t("save.saving");
      break;
    case "saved":
      text = t("save.saved", { time: formatSavedTime(save.at, locale) });
      break;
    case "retrying":
      text = t("save.retry");
      break;
    default:
      text = t("save.idle");
  }
  return (
    <p role="status" className={cn(SAVE_STATUS_CLASSES, className)}>
      {save.kind === "retrying" ? (
        <CircleAlertIcon
          aria-hidden="true"
          className="size-(--size-icon-md) shrink-0 text-feedback-warning-icon"
        />
      ) : null}
      {text}
    </p>
  );
}
