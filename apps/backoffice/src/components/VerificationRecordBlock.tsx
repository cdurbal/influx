"use client";

// Block ③ of the decision screen of a creator's verification request, "Ce que je constate" (docs/mvp/08
// RG25, RG37, RG38, RG38bis, RG41, RG42, RG48, CA13, CA25, CA27; 17b §3.7; jalons/l2e/modele.md -19;
// L2E-22): what the agent TYPES, never pre-filled, never copied from the declared (CA25). For the account:
// the handle seen on the public profile and the code read there, which the database compares (it is never
// shown). For the audience: the handle seen on the piece, the three priority figures in the order of D61,
// the period displayed, the facultative engagement. The declared figures and the gap come back after the
// typing, on a button, from the database (modele -19), and say that they are internal. No rule here.
import type { VerificationOpenResponse } from "@influx/contracts/verification";
import { useEffect, useId } from "react";
import { messages } from "@/messages/fr";
import { HELP_CLASSES, inputClasses } from "./auth-classes";
import {
  BLOCK_TITLE,
  FIELD_CLASSES,
  SECTION_CLASSES,
  SECTION_TITLE,
  SMALL_PRIMARY_CLASSES,
  SMALL_SECONDARY_CLASSES,
  TABLE_CLASSES,
  TD_CLASSES,
  TH_CLASSES,
} from "./bo-classes";
import { DenseTableRegion } from "./DenseTableRegion";
import { ErrorNotice } from "./ErrorNotice";
import type { Comparison } from "./use-verification-entry";
import {
  comparisonRows,
  figuresKeyOf,
  isAudience,
  type Draft,
  type FieldName,
  type Problem,
} from "./verification-decision-view";

const t = messages.verificationReview;

export const FIELD_ID = (field: FieldName) => `verification-record-${field}`;

export function TypedField({
  field,
  label,
  help,
  value,
  problem,
  inputMode,
  type = "text",
  mono,
  onChange,
}: {
  field: FieldName;
  label: string;
  help?: string;
  value: string;
  problem: Problem | null;
  inputMode?: "numeric" | "decimal";
  type?: "text" | "date";
  mono?: boolean;
  onChange: (next: string) => void;
}) {
  const ids = { help: useId(), problem: useId() };
  const mine = problem?.field === field ? problem : null;
  return (
    <div className={FIELD_CLASSES}>
      <label
        htmlFor={FIELD_ID(field)}
        className="text-sm font-semibold text-text-primary"
      >
        {label}
      </label>
      <input
        id={FIELD_ID(field)}
        type={type}
        {...(inputMode === undefined ? {} : { inputMode })}
        value={value}
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        aria-invalid={mine !== null || undefined}
        aria-describedby={
          [
            help === undefined ? null : ids.help,
            mine === null ? null : ids.problem,
          ]
            .filter((id) => id !== null)
            .join(" ") || undefined
        }
        onChange={(event) => onChange(event.target.value)}
        className={`${inputClasses(mine !== null)}${mono === true ? " font-mono" : ""}`}
      />
      {help === undefined ? null : (
        <p id={ids.help} className={HELP_CLASSES}>
          {help}
        </p>
      )}
      {mine === null ? null : (
        <ErrorNotice id={ids.problem} announce={false}>
          {mine.text}
        </ErrorNotice>
      )}
    </div>
  );
}

function ComparisonTable({
  comparison,
  draft,
}: {
  comparison: Comparison;
  draft: Draft;
}) {
  const rows = comparisonRows(comparison.typed, comparison.result);
  const percent = comparison.result.gapAlertPercent;
  return (
    <div className="flex flex-col gap-2" data-comparison>
      <h3 className={BLOCK_TITLE}>{t.sections.comparison}</h3>
      <p className={HELP_CLASSES}>{t.comparison.lead}</p>
      {comparison.key === figuresKeyOf(draft) ? null : (
        <p role="status" className="text-sm font-semibold text-text-primary">
          {t.comparison.stale}
        </p>
      )}
      <DenseTableRegion label={t.comparison.tableLabel}>
        <table className={TABLE_CLASSES}>
          <thead>
            <tr>
              {(
                [
                  t.comparison.columns.figure,
                  t.comparison.columns.declared,
                  t.comparison.columns.observed,
                  t.comparison.columns.gap,
                ] as const
              ).map((header) => (
                <th key={header} scope="col" className={TH_CLASSES}>
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <th scope="row" className={`${TD_CLASSES} text-left`}>
                  {row.figure}
                </th>
                <td className={`${TD_CLASSES} tabular-nums`}>{row.declared}</td>
                <td className={`${TD_CLASSES} tabular-nums`}>{row.observed}</td>
                <td className={`${TD_CLASSES} tabular-nums`}>{row.gap}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </DenseTableRegion>
      <p
        className={
          comparison.result.alert
            ? "text-sm font-semibold text-text-primary"
            : "text-sm text-text-primary"
        }
      >
        {comparison.result.alert
          ? t.comparison.alert(percent)
          : t.comparison.noAlert(percent)}
      </p>
    </div>
  );
}

export function RecordBlock({
  view,
  draft,
  problem,
  comparison,
  busy,
  comparing,
  onDraft,
  onCompare,
}: {
  view: VerificationOpenResponse;
  draft: Draft;
  problem: Problem | null;
  comparison: Comparison | null;
  busy: boolean;
  comparing: boolean;
  onDraft: (next: Draft) => void;
  onCompare: () => void;
}) {
  const audience = isAudience(view);

  // A refused field takes the focus: the agent goes on from there (the typed text is still all there).
  const failing = problem?.field ?? null;
  useEffect(() => {
    const target =
      failing === null
        ? null
        : failing === "period"
          ? "verification-record-period-start"
          : FIELD_ID(failing);
    if (target !== null) {
      document.getElementById(target)?.focus();
    }
  }, [failing, problem]);

  const set = (patch: Partial<Draft>) => onDraft({ ...draft, ...patch });
  const periodProblem = problem?.field === "period" ? problem : null;

  return (
    <section aria-labelledby="verification-record" className={SECTION_CLASSES}>
      <h2 id="verification-record" className={SECTION_TITLE}>
        {t.sections.record}
      </h2>
      <p className={HELP_CLASSES}>{t.record.lead}</p>
      <TypedField
        field="handle"
        label={audience ? t.record.handleAudience : t.record.handleAccount}
        value={draft.handle}
        problem={problem}
        mono
        onChange={(handle) => set({ handle })}
      />
      {audience ? (
        <>
          <h3 className={BLOCK_TITLE}>{t.record.priority}</h3>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <TypedField
              field="followers"
              label={t.record.followers}
              help={t.record.followersHelp}
              value={draft.followers}
              problem={problem}
              inputMode="numeric"
              onChange={(followers) => set({ followers })}
            />
            <TypedField
              field="posts"
              label={t.record.posts}
              help={t.record.postsHelp}
              value={draft.posts}
              problem={problem}
              inputMode="numeric"
              onChange={(posts) => set({ posts })}
            />
            <TypedField
              field="comments"
              label={t.record.comments}
              help={t.record.commentsHelp}
              value={draft.comments}
              problem={problem}
              inputMode="numeric"
              onChange={(comments) => set({ comments })}
            />
          </div>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-semibold text-text-primary">
              {t.record.periodLegend}
            </legend>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className={FIELD_CLASSES}>
                <label
                  htmlFor="verification-record-period-start"
                  className="text-sm font-semibold text-text-primary"
                >
                  {t.record.periodStart}
                </label>
                <input
                  id="verification-record-period-start"
                  type="date"
                  value={draft.periodStart}
                  aria-invalid={periodProblem !== null || undefined}
                  onChange={(event) => set({ periodStart: event.target.value })}
                  className={inputClasses(periodProblem !== null)}
                />
              </div>
              <div className={FIELD_CLASSES}>
                <label
                  htmlFor="verification-record-period-end"
                  className="text-sm font-semibold text-text-primary"
                >
                  {t.record.periodEnd}
                </label>
                <input
                  id="verification-record-period-end"
                  type="date"
                  value={draft.periodEnd}
                  aria-invalid={periodProblem !== null || undefined}
                  onChange={(event) => set({ periodEnd: event.target.value })}
                  className={inputClasses(periodProblem !== null)}
                />
              </div>
            </div>
            {periodProblem === null ? null : (
              <ErrorNotice>{periodProblem.text}</ErrorNotice>
            )}
          </fieldset>
          <TypedField
            field="engagement"
            label={t.record.engagement}
            help={t.record.engagementHelp}
            value={draft.engagement}
            problem={problem}
            inputMode="decimal"
            onChange={(engagement) => set({ engagement })}
          />
          <p className={HELP_CLASSES}>{t.record.today}</p>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              aria-disabled={busy || undefined}
              onClick={() => {
                if (!busy) {
                  onCompare();
                }
              }}
              className={
                comparison === null
                  ? SMALL_PRIMARY_CLASSES
                  : SMALL_SECONDARY_CLASSES
              }
            >
              {comparing ? t.decision.busy : t.comparison.button}
            </button>
          </div>
          {comparison === null ? null : (
            <ComparisonTable comparison={comparison} draft={draft} />
          )}
        </>
      ) : (
        <TypedField
          field="code"
          label={t.record.code}
          help={t.record.codeHelp}
          value={draft.code}
          problem={problem}
          mono
          onChange={(code) => set({ code })}
        />
      )}
    </section>
  );
}
