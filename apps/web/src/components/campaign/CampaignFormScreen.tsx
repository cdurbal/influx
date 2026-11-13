"use client";

// The campaign form (docs/mvp/17 §4.3, M3; 09 RG4, RG108 to RG110; jalons/l3b, commits 09 and 10): the
// five steps, the brand moving from one to another freely, "Étape n sur 5" at the head below lg, the draft
// saved by itself (what changed only), a failed save told by a banner that keeps the entry, the
// campaign taken up again where it was left, submitted from any step (the button always there, the
// list of what is missing, by step, a way to each field). The steps are links of the page itself, in the column
// from lg: a list, never a second navigation landmark (the space keeps one, 18 TD5.1). A campaign
// the brand no longer writes (submitted, published) reads as it is, its fields set. The state is
// use-campaign.ts, the rules campaign-view.ts and apps/api; this file draws. The page of a brand: a
// creator, another brand's campaign and an identifier that is nobody's all reach a page that does
// not exist, as the API answers (T14). No amount is entered, shown or computed (CLAUDE.md §2, D78).
import type { CampaignResponse } from "@influx/contracts/campaign";
import { notFound } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  BACK_ICON_CLASSES,
  BACK_LINK_CLASSES,
} from "@/components/account/account-classes";
import { useOnline } from "@/components/auth/use-online";
import { formatSavedTime } from "@/components/brand-profile/brand-profile-view";
import { useMember } from "@/components/member/member-context";
import { MemberButton } from "@/components/member/ui/MemberButton";
import { Notice } from "@/components/member/ui/Notice";
import { PageBackContext, PageHeader } from "@/components/member/ui/PageHeader";
import { StatusBadge } from "@/components/member/ui/StatusBadge";
import { SECTION_TITLE } from "@/components/member/ui/heading-classes";
import { cn } from "@/components/ui/class-names";
import { ErrorNotice } from "@/components/ui/ErrorNotice";
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  CircleAlertIcon,
} from "@/components/ui/icons";
import { Link } from "@/i18n/navigation";
import { memberPageHref } from "@/lib/member-paths";
import { CampaignAudienceFields } from "./CampaignAudienceFields";
import { CampaignBudgetFields } from "./CampaignBudgetFields";
import { CampaignCalendarFields } from "./CampaignCalendarFields";
import { CampaignSubmitPanel } from "./CampaignSubmitPanel";
import {
  CAMPAIGN_ASIDE_CLASSES,
  CAMPAIGN_CARD_CLASSES,
  CAMPAIGN_FIELDSET_CLASSES,
  CAMPAIGN_FORM_CLASSES,
  CAMPAIGN_GRID_CLASSES,
  CAMPAIGN_PAGE_CLASSES,
  CAMPAIGN_SAVE_STATUS_CLASSES,
  STEP_LIST_CLASSES,
  STEP_MISSING_CLASSES,
  STEP_NAME_CLASSES,
  STEP_NAV_CLASSES,
  STEPS_SUMMARY_CLASSES,
  stepButtonClasses,
} from "./campaign-classes";
import { campaignOptionsOf } from "./campaign-options";
import {
  fieldErrorText,
  type CampaignFieldsProps,
} from "./campaign-field-texts";
import {
  AVAILABLE_STEPS,
  controlIdOf,
  isEditable,
  isKeyOfStep,
  missingOfStep,
  STATUS_TEXT_KEYS,
  STATUS_TONES,
  TOTAL_STEPS,
  type CampaignDraft,
  type DraftKey,
  type FieldError,
} from "./campaign-view";
import type { CampaignStep } from "./campaign-domain";
import { CampaignOfferFields } from "./CampaignOfferFields";
import { CampaignWorkFields } from "./CampaignWorkFields";
import {
  useCampaign,
  type CampaignState,
  type SaveState,
} from "./use-campaign";

/** The page of a brand; any other role finds a page that does not exist (18 T14.3, T14.4). */
export function CampaignFormScreen({
  id,
  initialStep,
}: {
  id: string;
  initialStep: CampaignStep;
}) {
  const { me } = useMember();
  if (me.role !== "advertiser") {
    notFound();
  }
  return <CampaignFormView id={id} initialStep={initialStep} />;
}

function CampaignFormView({
  id,
  initialStep,
}: {
  id: string;
  initialStep: CampaignStep;
}) {
  const t = useTranslations("campaign");
  const tAccount = useTranslations("account");
  const locale = useLocale();
  const online = useOnline();
  const { signedOut } = useMember();
  const state = useCampaign(id, { onSignedOut: () => signedOut(null) });

  const back = (
    <Link
      href={memberPageHref("advertiserCampaigns", locale)}
      className={BACK_LINK_CLASSES}
    >
      <span className="sr-only">{t("form.backPrefix")} </span>
      <ChevronLeftIcon aria-hidden="true" className={BACK_ICON_CLASSES} />
      {t("form.back")}
    </Link>
  );

  const { phase, campaign, draft } = state;
  if (phase === "gone") {
    notFound();
  }

  let body: ReactNode;
  if (phase === "loading" || campaign === null || draft === null) {
    body =
      phase === "unavailable" ? (
        <div className="flex flex-col gap-4">
          <ErrorNotice>{t("form.unavailable")}</ErrorNotice>
          <MemberButton variant="secondary" onClick={state.reload}>
            {t("form.retry")}
          </MemberButton>
        </div>
      ) : (
        <p role="status" className="text-sm text-text-secondary">
          {t("form.loading")}
        </p>
      );
  } else {
    body = (
      <LoadedCampaign
        state={state}
        campaign={campaign}
        draft={draft}
        locale={locale}
        initialStep={initialStep}
      />
    );
  }

  return (
    <PageBackContext value={back}>
      <div className={CAMPAIGN_PAGE_CLASSES}>
        {online ? null : <Notice tone="warning">{tAccount("offline")}</Notice>}
        <PageHeader
          title={
            campaign?.title === null || campaign === null
              ? t("form.newTitle")
              : campaign.title
          }
        />
        {body}
      </div>
    </PageBackContext>
  );
}

function LoadedCampaign({
  state,
  campaign,
  draft,
  locale,
  initialStep,
}: {
  state: CampaignState;
  campaign: CampaignResponse;
  draft: NonNullable<CampaignState["draft"]>;
  locale: string;
  initialStep: CampaignStep;
}) {
  const t = useTranslations("campaign");
  const tBrand = useTranslations("brandProfile");
  const [step, setStep] = useState<CampaignStep>(initialStep);
  const headingId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const shownStep = useRef(step);
  // The field a submission sends the brand to in another step: focused once that step is drawn.
  const pendingFocus = useRef<DraftKey | null>(null);
  const options = useMemo(
    () => campaignOptionsOf(t, tBrand, locale, campaign.references),
    [t, tBrand, locale, campaign.references],
  );
  const editable = isEditable(campaign.status);

  // Navigating between the steps is free (17 §4.3): the address follows, so that a reload comes
  // back to the step, and the focus goes to the title of the new one (17 §2.2), never at the first load.
  const goTo = useCallback((next: CampaignStep) => {
    setStep(next);
    window.history.replaceState(null, "", `?step=${next}`);
  }, []);
  useEffect(() => {
    if (shownStep.current === step) {
      return;
    }
    shownStep.current = step;
    const wanted = pendingFocus.current;
    pendingFocus.current = null;
    const control =
      wanted === null ? null : document.getElementById(controlIdOf(wanted));
    (control ?? headingRef.current)?.focus();
  }, [step]);
  /** A way to a field (the list of what is missing): its step opens, its control takes the focus. */
  const goToField = useCallback(
    (target: CampaignStep, key: DraftKey) => {
      if (target === step) {
        document.getElementById(controlIdOf(key))?.focus();
        return;
      }
      pendingFocus.current = key;
      goTo(target);
    },
    [goTo, step],
  );

  const fields: CampaignFieldsProps = {
    campaign,
    references: campaign.references,
    draft,
    errors: state.fieldErrors,
    options,
    change: state.change,
  };
  const index = AVAILABLE_STEPS.indexOf(step);
  const previous = AVAILABLE_STEPS[index - 1];
  const next = AVAILABLE_STEPS[index + 1];

  return (
    <>
      <StatusLine campaign={campaign} />
      {state.submitState === "done" ? <Submitted /> : null}
      {state.save.kind === "retrying" ? (
        <Notice tone="warning">
          <p className="font-semibold">{t("save.failedTitle")}</p>
          <p>{t("save.failedText")}</p>
          <MemberButton
            variant="secondary"
            className="mt-2"
            onClick={state.retryNow}
          >
            {t("save.retryNow")}
          </MemberButton>
        </Notice>
      ) : null}
      {editable ? null : <Notice tone="info">{t("form.locked")}</Notice>}
      <div className={CAMPAIGN_GRID_CLASSES}>
        <div className={CAMPAIGN_FORM_CLASSES}>
          <section
            aria-labelledby={headingId}
            data-step={step}
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-1">
              <h2
                id={headingId}
                ref={headingRef}
                tabIndex={-1}
                className={cn(SECTION_TITLE, "text-text-primary")}
              >
                {t(`form.steps.${step}.title`)}
              </h2>
              <p className="text-md text-text-secondary">
                {t(`form.steps.${step}.question`)}
              </p>
              {step === 1 && editable ? (
                <p className="text-sm text-text-secondary">{t("form.intro")}</p>
              ) : null}
            </div>
            <StepErrors state={state} step={step} draft={draft} />
            <fieldset
              disabled={!editable}
              className={CAMPAIGN_FIELDSET_CLASSES}
            >
              {step === 1 ? <CampaignOfferFields {...fields} /> : null}
              {step === 2 ? <CampaignWorkFields {...fields} /> : null}
              {step === 3 ? <CampaignAudienceFields {...fields} /> : null}
              {step === 4 ? <CampaignBudgetFields {...fields} /> : null}
              {step === 5 ? <CampaignCalendarFields {...fields} /> : null}
            </fieldset>
          </section>
          <div className={STEP_NAV_CLASSES}>
            {previous === undefined ? (
              <span />
            ) : (
              <MemberButton variant="secondary" onClick={() => goTo(previous)}>
                {t("form.previous")}
              </MemberButton>
            )}
            {next === undefined ? null : (
              <MemberButton onClick={() => goTo(next)}>
                {t("form.next")}
              </MemberButton>
            )}
          </div>
          {editable ? (
            <CampaignSubmitPanel
              state={state}
              campaign={campaign}
              draft={draft}
              onGoTo={goToField}
            />
          ) : null}
          <SaveStatus
            save={state.save}
            locale={locale}
            className="max-lg:hidden"
          />
        </div>
        <aside className={CAMPAIGN_ASIDE_CLASSES}>
          <div className={CAMPAIGN_CARD_CLASSES}>
            <Steps
              campaign={campaign}
              step={step}
              onStep={goTo}
              save={state.save}
              locale={locale}
            />
          </div>
        </aside>
      </div>
    </>
  );
}

/**
 * The success of a submission (17 §4.3 "succès"): the state in its own words, what follows and the way
 * back to the list. The button it replaces is gone, so the focus comes here.
 */
function Submitted() {
  const t = useTranslations("campaign");
  const locale = useLocale();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return (
    <div ref={ref} tabIndex={-1} role="status">
      <Notice tone="success" announce={false}>
        <p className="font-semibold">{t("publish.submittedTitle")}</p>
        <p>{t("status.pending")}</p>
        <p>{t("publish.submittedText")}</p>
        <Link
          href={memberPageHref("advertiserCampaigns", locale)}
          className="mt-2 inline-block underline"
        >
          {t("publish.backToList")}
        </Link>
      </Notice>
    </div>
  );
}

/** CA74: the state of the campaign, written, with what it allows. */
function StatusLine({ campaign }: { campaign: CampaignResponse }) {
  const t = useTranslations("campaign");
  return (
    <div className="flex flex-wrap items-center gap-3">
      <StatusBadge tone={STATUS_TONES[campaign.status]}>
        {t(`status.label.${campaign.status}`)}
      </StatusBadge>
      <p className="text-sm text-text-secondary">
        {t(`status.${STATUS_TEXT_KEYS[campaign.status]}`)}
      </p>
    </div>
  );
}

/**
 * The fields of the step the browser or the API refused (17 §4.3 "erreur de saisie": a message by field
 * and the list at the head of the step): each one is a button that goes to its field.
 */
function StepErrors({
  state,
  step,
  draft,
}: {
  state: CampaignState;
  step: CampaignStep;
  draft: CampaignDraft;
}) {
  const t = useTranslations("campaign");
  const entries = (
    Object.entries(state.fieldErrors) as [DraftKey, FieldError][]
  )
    .filter(([key]) => isKeyOfStep(key, step, draft))
    .map(([key, error]) => ({ key, error }));
  if (entries.length === 0) {
    return null;
  }
  return (
    <ErrorNotice announce={false}>
      <p className="font-semibold">{t("form.errorsTitle")}</p>
      <ul className="flex list-disc flex-col gap-1 pl-5">
        {entries.map(({ key, error }) => (
          <li key={key}>
            <button
              type="button"
              className="text-left underline"
              onClick={() => document.getElementById(controlIdOf(key))?.focus()}
            >
              {t(`fields.${key}.label`)}
            </button>
            <span className="block">
              {fieldErrorText(t, key, error, draft)}
            </span>
          </li>
        ))}
      </ul>
    </ErrorNotice>
  );
}

/**
 * The steps and where the brand stands in them: "Étape n sur 5" at the head, each step with what is
 * still to complete in it (written, from the API's own count), the way to every step free. From lg the
 * list is open in the column; below, it opens from the line "Étape n sur 5".
 */
function Steps({
  campaign,
  step,
  onStep,
  save,
  locale,
}: {
  campaign: CampaignResponse;
  step: CampaignStep;
  onStep: (step: CampaignStep) => void;
  save: SaveState;
  locale: string;
}) {
  const t = useTranslations("campaign");
  const list = (
    <ol aria-label={t("form.stepsLabel")} className={STEP_LIST_CLASSES}>
      {AVAILABLE_STEPS.map((item) => {
        const missing = missingOfStep(campaign.missingRequired, item).length;
        return (
          <li key={item}>
            <button
              type="button"
              aria-current={item === step ? "step" : undefined}
              onClick={() => onStep(item)}
              className={stepButtonClasses(item === step)}
            >
              <span className={STEP_NAME_CLASSES}>
                {t("form.stepName", {
                  number: item,
                  title: t(`form.steps.${item}.title`),
                })}
              </span>
              <span className={STEP_MISSING_CLASSES}>
                {t("form.stepMissing", { count: missing })}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
  return (
    <>
      <p className="font-display text-md font-bold text-text-primary">
        {t("form.step", { step, total: TOTAL_STEPS })}
      </p>
      <div className="max-lg:hidden">{list}</div>
      <details className="lg:hidden">
        <summary className={STEPS_SUMMARY_CLASSES}>
          {t(`form.steps.${step}.title`)}
          <ChevronDownIcon
            aria-hidden="true"
            className="size-(--size-icon-md) shrink-0 text-text-secondary"
          />
        </summary>
        {list}
      </details>
      <SaveStatus save={save} locale={locale} className="lg:hidden" />
    </>
  );
}

/** "Enregistré automatiquement à 14 h 07" (RG108), and the retry told when the save failed. */
function SaveStatus({
  save,
  locale,
  className,
}: {
  save: SaveState;
  locale: string;
  className?: string;
}) {
  const t = useTranslations("campaign");
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
    <p role="status" className={cn(CAMPAIGN_SAVE_STATUS_CLASSES, className)}>
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
