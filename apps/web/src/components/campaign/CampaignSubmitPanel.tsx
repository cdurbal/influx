"use client";

// The submission of a campaign (docs/mvp/17 §4.3; 09 RG4, RG5, RG80, RG85; jalons/l3b, commit 10): the
// button "Soumettre ma campagne" is always there and never disabled without a word, and it carries the
// nominal list of what is missing, by step, each name a way to its field (CA3). A click saves what is
// on the screen, then names what is missing and takes the focus to the first field; a campaign that
// lacks nothing is submitted, the brand profile being published (CA2). A product of a sensitive
// category (RG84) asks the declaration of authorizations: a box NEVER pre-ticked, its text the exact
// one the base keeps (what is shown is what is kept, hashed), refused without it (CA56). The count
// and the names of what is missing are the API's own: nothing is computed here. No delay is
// announced as a figure: it is a parameter of the table (RG6, Q9), not of this screen (EC-L3B-10-2).
import type { CampaignResponse } from "@influx/contracts/campaign";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { MemberButton } from "@/components/member/ui/MemberButton";
import { Notice } from "@/components/member/ui/Notice";
import { CARD_TITLE } from "@/components/member/ui/heading-classes";
import {
  memberChoiceInputClasses,
  memberChoiceRowClasses,
} from "@/components/member/ui/field-classes";
import { ErrorNotice } from "@/components/ui/ErrorNotice";
import { Link } from "@/i18n/navigation";
import { memberPageHref } from "@/lib/member-paths";
import { CAMPAIGN_CARD_CLASSES } from "./campaign-classes";
import {
  missingGroups,
  type CampaignDraft,
  type DraftKey,
} from "./campaign-view";
import type { CampaignStep } from "./campaign-domain";
import type { CampaignState, SubmitOutcome } from "./use-campaign";

/** The id of the box of RG85: the focus goes to it when a submission asks for it. */
export const DECLARATION_CONTROL_ID = "campaign-declaration";

/** The submission, written once: the panel in the flow and the bar of a phone both call it. */
export type Submission = {
  declared: boolean;
  setDeclared: (declared: boolean) => void;
  /** The exact text of the box of RG85 in the language of the page, else the first the base holds. */
  declaration:
    | CampaignResponse["references"]["authorizationDeclarations"][number]
    | undefined;
  busy: boolean;
  submit: () => Promise<void>;
};

export function useSubmission(
  state: CampaignState,
  campaign: CampaignResponse,
  /** Takes the brand to a field of a step and focuses it. */
  onGoTo: (step: CampaignStep, key: DraftKey) => void,
): Submission {
  const locale = useLocale();
  const [declared, setDeclared] = useState(false);
  const declaration =
    campaign.references.authorizationDeclarations.find(
      (entry) => entry.locale === locale,
    ) ?? campaign.references.authorizationDeclarations[0];
  const busy = state.submitState === "submitting";

  async function submit() {
    const outcome: SubmitOutcome = await state.submit(
      declared && declaration !== undefined ? declaration.locale : null,
    );
    if (outcome.kind === "missing" || outcome.kind === "invalid") {
      onGoTo(outcome.step, outcome.key);
    } else if (outcome.kind === "declaration") {
      document.getElementById(DECLARATION_CONTROL_ID)?.focus();
    }
  }
  return { declared, setDeclared, declaration, busy, submit };
}

export function CampaignSubmitPanel({
  state,
  campaign,
  draft,
  submission,
  onGoTo,
}: {
  state: CampaignState;
  campaign: CampaignResponse;
  draft: CampaignDraft;
  submission: Submission;
  onGoTo: (step: CampaignStep, key: DraftKey) => void;
}) {
  const t = useTranslations("campaign");
  const locale = useLocale();
  const { declared, setDeclared, declaration, busy, submit } = submission;
  const groups = missingGroups(campaign.missingRequired, draft);
  const count = groups.reduce((total, group) => total + group.keys.length, 0);
  const names = new Intl.ListFormat(locale, {
    style: "long",
    type: "conjunction",
  }).format(
    groups.flatMap((group) =>
      group.keys.map((key) => t(`fields.${key}.label`).toLowerCase()),
    ),
  );

  return (
    <section
      aria-labelledby="campaign-block-submit"
      data-submit-panel=""
      className={CAMPAIGN_CARD_CLASSES}
    >
      <h3 id="campaign-block-submit" className={CARD_TITLE}>
        {t("publish.title")}
      </h3>
      <p className="text-sm text-text-primary">
        {count === 0
          ? t("publish.ready")
          : t("publish.missing", { count, fields: names })}
      </p>
      {state.missingShown && count > 0 ? (
        <div className="flex flex-col gap-3">
          <p className="font-semibold text-text-primary">
            {t("publish.listTitle")}
          </p>
          {groups.map((group) => (
            <div key={group.step} className="flex flex-col gap-1">
              <p className="text-sm text-text-secondary">
                {t("form.stepName", {
                  number: group.step,
                  title: t(`form.steps.${group.step}.title`),
                })}
              </p>
              <ul className="flex list-disc flex-col gap-1 pl-5">
                {group.keys.map((key) => (
                  <li key={key}>
                    <button
                      type="button"
                      className="min-h-(--size-touch-target) text-left underline"
                      onClick={() => onGoTo(group.step, key)}
                    >
                      {t(`fields.${key}.label`)}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : null}
      {campaign.sectorIsSensitive && declaration !== undefined ? (
        <div className="flex flex-col gap-2">
          <Notice tone="info" announce={false}>
            {t("publish.sensitiveNotice")}
          </Notice>
          <label className={memberChoiceRowClasses()}>
            <input
              id={DECLARATION_CONTROL_ID}
              type="checkbox"
              checked={declared}
              aria-invalid={
                state.submitState === "declaration" ? true : undefined
              }
              aria-describedby={
                state.submitState === "declaration"
                  ? "campaign-declaration-error"
                  : undefined
              }
              onChange={(event) => setDeclared(event.target.checked)}
              className={memberChoiceInputClasses()}
            />
            <span>{declaration.body}</span>
          </label>
          {state.submitState === "declaration" ? (
            <ErrorNotice id="campaign-declaration-error" announce={false}>
              {t("publish.declarationRequired")}
            </ErrorNotice>
          ) : null}
        </div>
      ) : null}
      <SubmitFeedback state={state} onGoTo={onGoTo} />
      <div className="flex flex-col gap-2">
        <MemberButton
          aria-disabled={busy || undefined}
          onClick={() => {
            if (!busy) {
              void submit();
            }
          }}
        >
          {busy ? t("publish.busy") : t("publish.button")}
        </MemberButton>
        <p className="text-sm text-text-secondary">{t("publish.explain")}</p>
      </div>
    </section>
  );
}

/** What a submission that did not go through says, in words (RG4); a success is told by the screen. */
function SubmitFeedback({
  state,
  onGoTo,
}: {
  state: CampaignState;
  onGoTo: (step: CampaignStep, key: DraftKey) => void;
}) {
  const t = useTranslations("campaign");
  const locale = useLocale();
  switch (state.submitState) {
    case "unavailable":
      return <ErrorNotice>{t("publish.unavailable")}</ErrorNotice>;
    case "unsaved":
      return <ErrorNotice>{t("publish.unsaved")}</ErrorNotice>;
    case "invalid":
      return (
        <ErrorNotice>
          <p>{t("publish.invalid", { count: state.invalidShown.length })}</p>
          <ul className="flex list-disc flex-col gap-1 pl-5">
            {state.invalidShown.map(({ step, key }) => (
              <li key={key}>
                <button
                  type="button"
                  className="min-h-(--size-touch-target) text-left underline"
                  onClick={() => onGoTo(step, key)}
                >
                  {t(`fields.${key}.label`)}
                </button>
              </li>
            ))}
          </ul>
        </ErrorNotice>
      );
    case "locked":
      return <ErrorNotice>{t("publish.locked")}</ErrorNotice>;
    case "profileRequired":
      return (
        <ErrorNotice>
          <p>{t("publish.profileRequired")}</p>
          <Link
            href={memberPageHref("accountProfile", locale)}
            className="underline"
          >
            {t("list.profileLink")}
          </Link>
        </ErrorNotice>
      );
    default:
      return null;
  }
}
