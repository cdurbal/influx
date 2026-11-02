"use client";

// "Mon profil de marque" (docs/mvp/17 §4.2, M2; 06 RG3, RG5, RG82 to RG85; jalons/l2b, commit 11):
// blocks 1 to 3, saved by themselves, the score and what is missing in a sticky column (an
// accordion and an action bar on a phone), the submit button never disabled and always explained.
// The page of a brand: a creator reaches a page that does not exist, as the API answers (T14.3).
// The logo (commit 12), the home card and the rail block (commit 13) and block 4 (L2E) are not
// here. This file draws; the state is use-brand-profile.ts, the rules brand-profile-view.ts and
// apps/api. No amount, rate, net or price (CLAUDE.md §2, D48, D78).
import { notFound } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useId, useMemo, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { useOnline } from "@/components/auth/use-online";
import { formatDate } from "@/components/account/account-view";
import {
  BACK_ICON_CLASSES,
  BACK_LINK_CLASSES,
} from "@/components/account/account-classes";
import { useMember } from "@/components/member/member-context";
import { LayerBadge } from "@/components/member/ui/LayerBadge";
import { MemberButton } from "@/components/member/ui/MemberButton";
import { Notice } from "@/components/member/ui/Notice";
import { PageBackContext, PageHeader } from "@/components/member/ui/PageHeader";
import { ScoreGauge } from "@/components/member/ui/ScoreGauge";
import { cn } from "@/components/ui/class-names";
import { ErrorNotice } from "@/components/ui/ErrorNotice";
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  CircleAlertIcon,
} from "@/components/ui/icons";
import { Link } from "@/i18n/navigation";
import { memberPageHref } from "@/lib/member-paths";
import { profileOptionsOf } from "./brand-profile-options";
import {
  ACTION_BAR_CLASSES,
  PROFILE_ASIDE_CLASSES,
  PROFILE_CARD_CLASSES,
  PROFILE_FORM_CLASSES,
  PROFILE_GRID_CLASSES,
  PROFILE_PAGE_CLASSES,
  SAVE_STATUS_CLASSES,
  SECTION_BUTTON_CLASSES,
  SECTION_BUTTON_TITLE_CLASSES,
  SECTION_CHEVRON_CLASSES,
  SECTION_CHEVRON_OPEN_CLASSES,
  SECTION_FIELDSET_CLASSES,
  SECTION_HEADER_CLASSES,
  SECTION_PLAIN_TITLE_CLASSES,
  sectionBodyClasses,
} from "./brand-profile-classes";
import {
  controlIdOfRequired,
  isEditable,
  labelKeyOfRequired,
  sectionOfRequired,
  statusTextKeyOf,
  formatSavedTime,
  type SectionId,
} from "./brand-profile-view";
import {
  ContactFields,
  ExpectationFields,
  IdentityFields,
  type FieldsProps,
} from "./ProfileFields";
import { useBrandLogo } from "./use-brand-logo";
import {
  useBrandProfile,
  type BrandProfileState,
  type SaveState,
} from "./use-brand-profile";

/** The page of a brand; any other role finds a page that does not exist (18 T14.3, T14.4). */
export function BrandProfileScreen() {
  const { me } = useMember();
  if (me.role !== "advertiser") {
    notFound();
  }
  return <BrandProfileView />;
}

function BrandProfileView() {
  const t = useTranslations("brandProfile");
  const tAccount = useTranslations("account");
  const locale = useLocale();
  const online = useOnline();
  const { signedOut } = useMember();
  const state = useBrandProfile({ onSignedOut: () => signedOut(null) });
  const [openSection, setOpenSection] = useState<SectionId>("identity");

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
        openSection={openSection}
        onOpenSection={setOpenSection}
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
  openSection,
  onOpenSection,
}: {
  state: BrandProfileState;
  profile: NonNullable<BrandProfileState["profile"]>;
  draft: NonNullable<BrandProfileState["draft"]>;
  locale: string;
  openSection: SectionId;
  onOpenSection: (section: SectionId) => void;
}) {
  const t = useTranslations("brandProfile");
  const options = useMemo(
    () => profileOptionsOf(t, locale, profile.references),
    [t, locale, profile.references],
  );
  const editable = isEditable(profile.status);
  const { signedOut } = useMember();
  const logo = useBrandLogo({
    onSignedOut: () => signedOut(null),
    onCompleteness: state.adoptCompleteness,
  });
  const fields: FieldsProps = {
    profile,
    draft,
    errors: state.fieldErrors,
    options,
    change: state.change,
    websiteDomain: state.websiteDomain,
  };

  async function submit() {
    const outcome = await state.submit();
    if (outcome.kind !== "missing" || outcome.first === null) {
      return;
    }
    // CA7: the first missing field takes the focus, its section opened first below lg.
    flushSync(() => onOpenSection(sectionOfRequired(outcome.first!)));
    document.getElementById(controlIdOfRequired(outcome.first))?.focus();
  }

  return (
    <>
      <StatusBanner profile={profile} locale={locale} />
      <SubmitFeedback submitState={state.submitState} />
      <div className={PROFILE_GRID_CLASSES}>
        <div className={PROFILE_FORM_CLASSES}>
          <ProfileSection
            id="identity"
            title={t("section.identity")}
            sectionLayer
            open={openSection === "identity"}
            onToggle={() => onOpenSection("identity")}
            disabled={!editable}
          >
            <IdentityFields {...fields} logo={logo} />
          </ProfileSection>
          <ProfileSection
            id="expectations"
            title={t("section.expectations")}
            sectionLayer
            open={openSection === "expectations"}
            onToggle={() => onOpenSection("expectations")}
            disabled={!editable}
          >
            <ExpectationFields {...fields} />
          </ProfileSection>
          <ProfileSection
            id="contact"
            title={t("section.contact")}
            open={openSection === "contact"}
            onToggle={() => onOpenSection("contact")}
            disabled={!editable}
          >
            <ContactFields {...fields} />
          </ProfileSection>
          <SaveStatus
            save={state.save}
            locale={locale}
            className="max-lg:hidden"
          />
        </div>
        <aside className={PROFILE_ASIDE_CLASSES}>
          <ProfileProgress profile={profile} onSubmit={submit} state={state} />
        </aside>
      </div>
      <div data-action-bar="" className={ACTION_BAR_CLASSES}>
        <SaveStatus save={state.save} locale={locale} />
        <MemberButton
          aria-disabled={state.submitState === "submitting" || undefined}
          onClick={() => void submit()}
        >
          {state.submitState === "submitting"
            ? t("submit.busy")
            : t("submit.label")}
        </MemberButton>
      </div>
    </>
  );
}

/** The state of the profile, written (RG3, CA47): a word, then what it allows, never a colour alone. */
function StatusBanner({
  profile,
  locale,
}: {
  profile: NonNullable<BrandProfileState["profile"]>;
  locale: string;
}) {
  const t = useTranslations("brandProfile");
  const key = statusTextKeyOf(profile.status);
  const text =
    key === "pendingSince"
      ? `${t("status.pending")} ${t("statusText.pendingSince", {
          date:
            profile.submittedAt === null
              ? ""
              : formatDate(profile.submittedAt, locale === "en" ? "en" : "fr"),
        })}`
      : key === "rejectedReason"
        ? t("status.rejected", { reason: t("statusText.rejectedReason") })
        : t(`statusText.${key}`);
  const tone =
    profile.status === "published"
      ? "success"
      : profile.status === "rejected" || profile.status === "suspended"
        ? "warning"
        : "info";
  return (
    <Notice tone={tone} announce={false}>
      <p className="font-semibold text-text-primary">
        {t("state.label", { state: t(`state.${profile.status}`) })}
      </p>
      <p>{text}</p>
    </Notice>
  );
}

/** The answer of the last click on "Soumettre": success, or why nothing was sent. */
function SubmitFeedback({
  submitState,
}: {
  submitState: BrandProfileState["submitState"];
}) {
  const t = useTranslations("brandProfile");
  switch (submitState) {
    case "done":
      return <Notice tone="success">{t("submit.done")}</Notice>;
    case "unavailable":
      return <ErrorNotice>{t("submit.unavailable")}</ErrorNotice>;
    case "unsaved":
      return <ErrorNotice>{t("submit.unsaved")}</ErrorNotice>;
    case "locked":
      return <ErrorNotice>{t("submit.locked")}</ErrorNotice>;
    default:
      return null;
  }
}

/** "Enregistré automatiquement à 14 h 07" (RG83), and the retry told when the save failed. */
function SaveStatus({
  save,
  locale,
  className,
}: {
  save: SaveState;
  locale: string;
  className?: string;
}) {
  const t = useTranslations("brandProfile");
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

/** The score, what is missing by name (RG61) and the submit button, never disabled (RG5). */
function ProfileProgress({
  profile,
  state,
  onSubmit,
}: {
  profile: NonNullable<BrandProfileState["profile"]>;
  state: BrandProfileState;
  onSubmit: () => Promise<void>;
}) {
  const t = useTranslations("brandProfile");
  const locale = useLocale();
  const missing = profile.missingRequired;
  const names = new Intl.ListFormat(locale, {
    style: "long",
    type: "conjunction",
  }).format(
    missing.map((code) =>
      t(`fields.${labelKeyOfRequired(code)}.label`).toLowerCase(),
    ),
  );
  return (
    <div className={PROFILE_CARD_CLASSES}>
      <ScoreGauge
        label={t("completeness.label")}
        value={profile.completeness.score}
        valueText={t("completeness.value", {
          score: profile.completeness.score,
        })}
      />
      <p className="text-sm text-text-primary">
        {missing.length === 0
          ? t("progress.allSet")
          : t("publish.missing", { count: missing.length, fields: names })}
      </p>
      <div className="flex flex-col gap-2 max-lg:hidden">
        <MemberButton
          fullWidth
          aria-disabled={state.submitState === "submitting" || undefined}
          onClick={() => void onSubmit()}
        >
          {state.submitState === "submitting"
            ? t("submit.busy")
            : t("submit.label")}
        </MemberButton>
        <p className="text-sm text-text-secondary">{t("submit.explain")}</p>
      </div>
    </div>
  );
}

/**
 * A block of the form (17 §4.2): a card with its title and, for the public ones, its layer badge.
 * From lg the title is a plain heading and every block is open; below, the title is the button of
 * an accordion, one block open at a time, the others out of sight and of the accessibility tree.
 */
function ProfileSection({
  id,
  title,
  sectionLayer = false,
  open,
  onToggle,
  disabled,
  children,
}: {
  id: SectionId;
  title: string;
  sectionLayer?: boolean;
  open: boolean;
  onToggle: () => void;
  disabled: boolean;
  children: ReactNode;
}) {
  const t = useTranslations("brandProfile");
  const panelId = useId();
  return (
    <section
      aria-label={title}
      data-section={id}
      className={PROFILE_CARD_CLASSES}
    >
      <div className={SECTION_HEADER_CLASSES}>
        <h2 className={SECTION_PLAIN_TITLE_CLASSES}>{title}</h2>
        <h2 className={SECTION_BUTTON_TITLE_CLASSES}>
          <button
            type="button"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={onToggle}
            className={SECTION_BUTTON_CLASSES}
          >
            {title}
            <ChevronDownIcon
              aria-hidden="true"
              className={cn(
                SECTION_CHEVRON_CLASSES,
                open && SECTION_CHEVRON_OPEN_CLASSES,
              )}
            />
          </button>
        </h2>
        {sectionLayer ? (
          <LayerBadge layer="public" label={t("layer.public")} />
        ) : null}
      </div>
      <div id={panelId} className={sectionBodyClasses(open)}>
        <fieldset disabled={disabled} className={SECTION_FIELDSET_CLASSES}>
          {children}
        </fieldset>
      </div>
    </section>
  );
}
