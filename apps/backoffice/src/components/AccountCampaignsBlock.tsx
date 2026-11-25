"use client";

// The campaigns of a brand, on the record of its account (docs/mvp/09 RG1, RG94, CA61; 17b §3.5 block 4; jalons/
// l3c/modele.md §6; Q2; L3C-09): « Créer une campagne pour cette marque ». An agent opens a DRAFT for a brand that
// called: a title and a type, nothing else (never a form of eight blocks). The brand completes it and submits it
// itself, INFLUX never does; the act is journaled in the agent's name and the brand is told by e-mail. It only
// collects: the checks spare a round trip, the database decides (an account that is not active is refused).
import Link from "next/link";
import { useId, useState, type FormEvent } from "react";
import { messages } from "@/messages/fr";
import { HELP_CLASSES, inputClasses } from "./auth-classes";
import { ActionFeedback } from "./ActionFeedback";
import { createCampaignForBrand } from "./backoffice-api";
import {
  FIELD_CLASSES,
  ROW_GROUP_CLASSES,
  SECTION_CLASSES,
  SECTION_TITLE,
  SELECT_CLASSES,
  SMALL_LABEL_CLASSES,
  SMALL_PRIMARY_CLASSES,
  SUCCESS_CLASSES,
} from "./bo-classes";
import {
  actFailureOf,
  CAMPAIGN_TYPE_CODES,
  creationCheck,
  recordHref,
  type Problem,
} from "./campaign-record-view";
import { ErrorNotice } from "./ErrorNotice";
import { useAction } from "./use-action";

const t = messages.campaignRecord;

export function AccountCampaignsBlock({ accountId }: { accountId: string }) {
  const ids = { title: useId(), type: useId(), problem: useId() };
  const action = useAction();
  const [title, setTitle] = useState("");
  const [campaignType, setCampaignType] = useState("");
  const [problem, setProblem] = useState<Problem | null>(null);
  const [created, setCreated] = useState<{
    campaignId: string;
    title: string;
  } | null>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (action.busy) {
      return;
    }
    const checked = creationCheck(accountId, title, campaignType);
    if (!checked.ok) {
      setProblem(checked.problem);
      return;
    }
    setProblem(null);
    setCreated(null);
    void action.run(
      () => createCampaignForBrand(checked.body),
      (data) => {
        setCreated({ campaignId: data.campaignId, title: checked.body.title });
        setTitle("");
        setCampaignType("");
      },
      (code, issues) => actFailureOf(code, issues)?.text ?? null,
    );
  }

  const titleProblem = problem?.field === "title" ? problem : null;
  const typeProblem = problem?.field === "type" ? problem : null;
  return (
    <section aria-labelledby="brand-campaigns" className={SECTION_CLASSES}>
      <h2 id="brand-campaigns" className={SECTION_TITLE}>
        {t.create.title}
      </h2>
      <p className={HELP_CLASSES}>{t.create.lead}</p>
      <form
        noValidate
        onSubmit={submit}
        aria-label={t.create.formTitle}
        className="flex flex-col gap-3"
      >
        <div className={ROW_GROUP_CLASSES}>
          <div className={`${FIELD_CLASSES} min-w-(--size-input) flex-1`}>
            <label htmlFor={ids.title} className={SMALL_LABEL_CLASSES}>
              {t.create.titleLabel}
            </label>
            <input
              id={ids.title}
              type="text"
              value={title}
              aria-invalid={titleProblem !== null || undefined}
              aria-describedby={
                titleProblem === null ? undefined : `${ids.problem}-title`
              }
              onChange={(event) => setTitle(event.target.value)}
              className={inputClasses(titleProblem !== null)}
            />
          </div>
          <div className={FIELD_CLASSES}>
            <label htmlFor={ids.type} className={SMALL_LABEL_CLASSES}>
              {t.create.typeLabel}
            </label>
            <select
              id={ids.type}
              value={campaignType}
              aria-invalid={typeProblem !== null || undefined}
              aria-describedby={
                typeProblem === null ? undefined : `${ids.problem}-type`
              }
              onChange={(event) => setCampaignType(event.target.value)}
              className={SELECT_CLASSES}
            >
              <option value="">{t.create.typePlaceholder}</option>
              {CAMPAIGN_TYPE_CODES.map((code) => (
                <option key={code} value={code}>
                  {t.campaignTypes[code]}
                </option>
              ))}
            </select>
          </div>
        </div>
        {titleProblem === null ? null : (
          <ErrorNotice id={`${ids.problem}-title`}>
            {titleProblem.text}
          </ErrorNotice>
        )}
        {typeProblem === null ? null : (
          <ErrorNotice id={`${ids.problem}-type`}>
            {typeProblem.text}
          </ErrorNotice>
        )}
        <ActionFeedback action={action} />
        {created === null ? null : (
          <p role="status" className={SUCCESS_CLASSES}>
            {t.create.done(created.title)}{" "}
            <Link
              href={recordHref(created.campaignId)}
              className="text-feedback-success-text underline"
            >
              {t.create.open}
            </Link>
          </p>
        )}
        <button
          type="submit"
          aria-disabled={action.busy || undefined}
          className={`${SMALL_PRIMARY_CLASSES} self-start`}
        >
          {action.busy ? t.actions.busy : t.create.confirm}
        </button>
      </form>
    </section>
  );
}
