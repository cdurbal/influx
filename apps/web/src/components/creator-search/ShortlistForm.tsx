"use client";

// The form of a list of the brand (docs/mvp/10 RG51; 17 §4.9; jalons/l3f, commit 11): a name of 1 to 80 characters and,
// optionally, one of the brand's own campaigns to attach it to (RG51). One form for the two gestures: making a list
// (« Mes sélections ») and changing one (its page). The base checks the name and the campaign and the bounds of the
// lists; a refusal is told in words next to the field it concerns. Nothing is decided here.
import { useTranslations } from "next-intl";
import { useId, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/member/ui/Button";
import { Notice } from "@/components/member/ui/Notice";
import { TextField } from "@/components/member/ui/TextField";
import {
  MEMBER_FIELD_HELP_CLASSES,
  MEMBER_FIELD_LABEL_CLASSES,
  memberControlClasses,
} from "@/components/member/ui/field-classes";
import { ErrorNotice } from "@/components/ui/ErrorNotice";
import { FORM_CLASSES } from "./creator-search-classes";
import {
  nameProblemOf,
  SHORTLIST_NAME_MAX,
  type SelectionFailure,
} from "./shortlists-view";
import type { SelectionOutcome } from "./use-shortlists";
import type { OriginCampaign, SourceState } from "./use-search-sources";

export function ShortlistForm({
  initialName,
  initialCampaignId,
  campaigns,
  submitLabel,
  savedText,
  clearOnSuccess,
  onSubmit,
}: {
  initialName: string;
  initialCampaignId: string | null;
  campaigns: SourceState<OriginCampaign[]>;
  submitLabel: string;
  /** Said once the gesture went through (the change of a list); none for a list made, which appears. */
  savedText: string | null;
  clearOnSuccess: boolean;
  onSubmit: (
    name: string,
    campaignId: string | null,
  ) => Promise<SelectionOutcome>;
}) {
  const t = useTranslations("creatorSearch");
  const [name, setName] = useState(initialName);
  const [campaignId, setCampaignId] = useState<string | null>(
    initialCampaignId,
  );
  const [problem, setProblem] = useState<"empty" | "too_long" | null>(null);
  const [failure, setFailure] = useState<SelectionFailure | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);
  const campaignFieldId = useId();
  const options = campaigns.phase === "ready" ? campaigns.value : [];
  const known =
    campaignId === null || options.some((item) => item.id === campaignId);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (sending.current) {
      return;
    }
    const found = nameProblemOf(name);
    setProblem(found);
    setSaved(false);
    if (found !== null) {
      return;
    }
    sending.current = true;
    setBusy(true);
    setFailure(null);
    const outcome = await onSubmit(name.trim(), campaignId);
    sending.current = false;
    setBusy(false);
    if (outcome.kind === "refused") {
      setFailure(outcome.failure);
      return;
    }
    setSaved(true);
    if (clearOnSuccess) {
      setName("");
      setCampaignId(null);
    }
  }

  const nameError =
    problem !== null
      ? t(`lists.problem.${problem}`)
      : failure === "invalid_name"
        ? t("shortlist.refusal.invalid_name")
        : null;
  return (
    <form
      onSubmit={(event) => void submit(event)}
      className={FORM_CLASSES}
      data-shortlist-form=""
    >
      <TextField
        name="shortlist-name"
        label={t("lists.form.name")}
        value={name}
        maxLength={SHORTLIST_NAME_MAX}
        onChange={(value) => {
          setName(value);
          setSaved(false);
        }}
        error={nameError}
      />
      <div className="flex min-w-0 flex-col gap-1">
        <label htmlFor={campaignFieldId} className={MEMBER_FIELD_LABEL_CLASSES}>
          {t("lists.form.campaign")}
        </label>
        <select
          id={campaignFieldId}
          name="shortlist-campaign"
          value={campaignId ?? ""}
          onChange={(event) => {
            setCampaignId(
              event.target.value === "" ? null : event.target.value,
            );
            setSaved(false);
          }}
          className={memberControlClasses(false)}
        >
          <option value="">{t("campaign.none")}</option>
          {known || campaignId === null ? null : (
            <option value={campaignId}>{t("campaign.current")}</option>
          )}
          {options.map((item) => (
            <option key={item.id} value={item.id}>
              {item.title ?? t("campaign.untitled")}
            </option>
          ))}
        </select>
        <p className={MEMBER_FIELD_HELP_CLASSES}>
          {t("lists.form.campaignHelp")}
        </p>
        {campaigns.phase === "failed" ? (
          <p className={MEMBER_FIELD_HELP_CLASSES}>{t("campaign.failed")}</p>
        ) : null}
      </div>
      {failure === null || failure === "invalid_name" ? null : (
        <ErrorNotice>
          <span data-selection-failure={failure}>
            {t(`shortlist.refusal.${failure}`)}
          </span>
        </ErrorNotice>
      )}
      {saved && savedText !== null ? (
        <Notice tone="success">
          <span data-shortlist-saved="">{savedText}</span>
        </Notice>
      ) : null}
      <div>
        <Button type="submit" aria-disabled={busy} data-shortlist-submit="">
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
