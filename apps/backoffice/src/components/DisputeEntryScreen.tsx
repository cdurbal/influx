"use client";

// The decision screen of a contest, queue 5 (docs/mvp/08 RG77, CA52, CA53, RG98; 15 RG27 C1 to C8; 17b
// §2.7; jalons/l2f/modele.md §1 points 9 and 10, §5; L2F-19). Opening is claiming: the page calls POST
// …/open when it appears, and the register of apps/api keeps the opening. Three modes: it decides (the claim
// is the caller's), it reads (a colleague holds the contest, or the caller decided what is contested and
// another person judges it: a sentence, never an error screen, and no dossier), or the contest is closed.
// Two issues: confirm the decision with a motive of the closed list, or overturn it, typing again what is
// read (nothing is pre-filled, CA25). ‹v› and ‹r› open a panel and never decide. It only draws.
import type { DisputeOpenResponse } from "@influx/contracts/verification";
import { useId, useState } from "react";
import { messages } from "@/messages/fr";
import { HELP_CLASSES, inputClasses } from "./auth-classes";
import {
  FIELD_CLASSES,
  SECTION_CLASSES,
  SECTION_TITLE,
  SMALL_LABEL_CLASSES,
  SMALL_PRIMARY_CLASSES,
  SMALL_SECONDARY_CLASSES,
  TEXTAREA_CLASSES,
} from "./bo-classes";
import {
  openDisputeEntry,
  overturnDisputeEntry,
  readDisputeEvidence,
  releaseDisputeEntry,
  extendDisputeEntryClaim,
  forceReleaseDisputeEntryClaim,
  upholdDisputeEntry,
} from "./backoffice-api";
import { ClaimedEntryFrame, type ClaimedController } from "./ClaimedEntryFrame";
import { CommentField, DecisionPanel } from "./ClaimedDecisionParts";
import { ErrorNotice } from "./ErrorNotice";
import {
  ClosedDisputeBlock,
  ContestBlock,
  ContestedDecisionBlock,
} from "./DisputeDossierBlocks";
import {
  overturnCheck,
  overturnedMessageOf,
  overturnedNotice,
  overturnLead,
  overturnTargetOf,
  upheldNotice,
  upholdCheck,
  upholdReasonsOf,
  type DisputePanel,
  type OverturnTarget,
} from "./dispute-decision-view";
import {
  useClaimedEntry,
  type ClaimedApi,
  type ClaimedKeys,
} from "./use-claimed-entry";
import { useVerificationEvidence } from "./use-verification-evidence";
import { EvidencePieces } from "./VerificationEvidenceBlocks";
import { PeriodFields, TypedField } from "./VerificationRecordBlock";
import type { Draft, Problem } from "./verification-decision-view";
import { levelWords, networkWords } from "./verification-queue-view";
import { formatDateTime } from "./view-model";

const t = messages.disputeReview;
const d = t.decision;
const LIST = "/files/contestations";

const API: ClaimedApi<DisputeOpenResponse> = {
  open: openDisputeEntry,
  release: releaseDisputeEntry,
  extend: extendDisputeEntryClaim,
  forceRelease: forceReleaseDisputeEntryClaim,
};

/** ‹v› opens the overturn (the outcome that gives the badge back), ‹r› the confirmation of the decision. */
const KEYS: ClaimedKeys<DisputePanel> = {
  positive: "overturn",
  negative: "uphold",
};

const SHORTCUTS = {
  keys: t.shortcuts.keys,
  rows: [
    ["v", t.shortcuts.overturn],
    ["r", t.shortcuts.uphold],
    ["l", messages.claimedReview.shortcuts.release],
    ["Échap", messages.claimedReview.shortcuts.escape],
    ["?", messages.claimedReview.shortcuts.help],
  ],
} as const;

type Controller = ClaimedController<DisputeOpenResponse, DisputePanel>;

/** The fields an overturn types, by what was contested: nothing is offered pre-filled. */
function OverturnFields({
  target,
  draft,
  problem,
  onDraft,
}: {
  target: OverturnTarget;
  draft: Draft;
  problem: Problem | null;
  onDraft: (next: Draft) => void;
}) {
  const set = (patch: Partial<Draft>) => onDraft({ ...draft, ...patch });
  const periodProblem = problem?.field === "period" ? problem : null;
  return (
    <>
      <TypedField
        field="handle"
        label={d.handle}
        value={draft.handle}
        problem={problem}
        mono
        onChange={(handle) => set({ handle })}
      />
      {target === "refusal_account" ? (
        <TypedField
          field="code"
          label={d.code}
          help={d.codeHelp}
          value={draft.code}
          problem={problem}
          mono
          onChange={(code) => set({ code })}
        />
      ) : null}
      {target === "refusal_audience" ? (
        <>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <TypedField
              field="followers"
              label={d.followers}
              value={draft.followers}
              problem={problem}
              inputMode="numeric"
              onChange={(followers) => set({ followers })}
            />
            <TypedField
              field="posts"
              label={d.posts}
              value={draft.posts}
              problem={problem}
              inputMode="numeric"
              onChange={(posts) => set({ posts })}
            />
            <TypedField
              field="comments"
              label={d.comments}
              value={draft.comments}
              problem={problem}
              inputMode="numeric"
              onChange={(comments) => set({ comments })}
            />
          </div>
          <PeriodFields
            draft={draft}
            problem={periodProblem}
            onDraft={onDraft}
          />
          <TypedField
            field="engagement"
            label={d.engagement}
            help={d.engagementHelp}
            value={draft.engagement}
            problem={problem}
            inputMode="decimal"
            onChange={(engagement) => set({ engagement })}
          />
        </>
      ) : null}
      <CommentField draft={draft} problem={problem} onDraft={onDraft} />
    </>
  );
}

/** The motives of a confirmed decision as radio buttons: the agent SEES them, with the sentence the creator reads. */
function UpholdFields({
  view,
  draft,
  problem,
  outcomeCode,
  onOutcome,
  onDraft,
}: {
  view: DisputeOpenResponse;
  draft: Draft;
  problem: Problem | null;
  outcomeCode: string | null;
  onOutcome: (code: string) => void;
  onDraft: (next: Draft) => void;
}) {
  const ids = { message: useId(), problem: useId() };
  const reasons = upholdReasonsOf(view);
  const picked = reasons.find((reason) => reason.code === outcomeCode) ?? null;
  const reasonProblem = problem?.field === "reason" ? problem : null;
  const messageProblem = problem?.field === "memberMessage" ? problem : null;
  return (
    <>
      {reasons.length === 0 ? (
        <ErrorNotice>{d.noOutcomeReason}</ErrorNotice>
      ) : (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-semibold text-text-primary">
            {d.upholdLegend}
          </legend>
          {reasons.map((reason) => (
            <label
              key={reason.code}
              className="flex items-start gap-2 text-sm text-text-primary"
            >
              <input
                type="radio"
                name="dispute-outcome-reason"
                value={reason.code}
                checked={outcomeCode === reason.code}
                onChange={() => onOutcome(reason.code)}
                className="mt-1 size-(--size-checkbox)"
              />
              <span>{d.outcomeLabels[reason.code] ?? reason.code}</span>
            </label>
          ))}
          {reasonProblem === null ? null : (
            <ErrorNotice>{reasonProblem.text}</ErrorNotice>
          )}
        </fieldset>
      )}
      {picked === null ? null : (
        <>
          <p className={HELP_CLASSES}>{d.messageToCreator}</p>
          <blockquote
            data-member-sentence
            className="border-l-(length:--border-width-thick) border-border-strong pl-3 text-sm text-text-primary"
          >
            {picked.message}
          </blockquote>
          {picked.requiresMemberMessage ? (
            <div className={FIELD_CLASSES}>
              <label htmlFor={ids.message} className={SMALL_LABEL_CLASSES}>
                {d.ownMessage}
              </label>
              <textarea
                id={ids.message}
                value={draft.memberMessage}
                aria-invalid={messageProblem !== null || undefined}
                aria-describedby={
                  messageProblem === null ? undefined : ids.problem
                }
                onChange={(event) =>
                  onDraft({ ...draft, memberMessage: event.target.value })
                }
                className={`${TEXTAREA_CLASSES} ${inputClasses(messageProblem !== null)}`}
              />
              <p className={HELP_CLASSES}>{d.ownMessageHelp}</p>
              {messageProblem === null ? null : (
                <ErrorNotice id={ids.problem} announce={false}>
                  {messageProblem.text}
                </ErrorNotice>
              )}
            </div>
          ) : null}
        </>
      )}
      <CommentField draft={draft} problem={problem} onDraft={onDraft} />
    </>
  );
}

function Decision({
  entry,
  view,
  outcomeCode,
  onOutcome,
  onUphold,
  onOverturn,
}: {
  entry: Controller;
  view: DisputeOpenResponse;
  outcomeCode: string | null;
  onOutcome: (code: string) => void;
  onUphold: () => void;
  onOverturn: () => void;
}) {
  const { panel, problem, busy, draft } = entry;
  const target = overturnTargetOf(view);
  const busyNow = busy !== null;
  const open = (next: DisputePanel) => {
    entry.setProblem(null);
    entry.setPanel(next);
  };
  return (
    <section aria-labelledby="dispute-outcome" className={SECTION_CLASSES}>
      <h2 id="dispute-outcome" className={SECTION_TITLE}>
        {t.sections.outcome}
      </h2>
      <p className={HELP_CLASSES}>{d.lead}</p>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          aria-keyshortcuts="v"
          aria-expanded={panel === "overturn"}
          aria-disabled={busyNow || undefined}
          onClick={() => {
            if (!busyNow) {
              open("overturn");
            }
          }}
          className={
            panel === "overturn"
              ? SMALL_SECONDARY_CLASSES
              : SMALL_PRIMARY_CLASSES
          }
        >
          {d.overturn}
        </button>
        <button
          type="button"
          aria-keyshortcuts="r"
          aria-expanded={panel === "uphold"}
          aria-disabled={busyNow || undefined}
          onClick={() => {
            if (!busyNow) {
              open("uphold");
            }
          }}
          className={SMALL_SECONDARY_CLASSES}
        >
          {d.uphold}
        </button>
      </div>
      {panel === "overturn" && target !== null ? (
        <DecisionPanel
          id="dispute-overturn"
          title={d.overturnTitle}
          lead={overturnLead(target)}
          problem={problem}
          busy={busy === "overturn"}
          busyNow={busyNow}
          confirmLabel={d.overturnConfirm}
          onConfirm={onOverturn}
          onCancel={() => entry.setPanel(null)}
        >
          <OverturnFields
            target={target}
            draft={draft}
            problem={problem}
            onDraft={entry.setDraft}
          />
          {overturnedMessageOf(view) === null ? null : (
            <>
              <p className={HELP_CLASSES}>{d.messageToCreator}</p>
              <blockquote className="border-l-(length:--border-width-thick) border-border-strong pl-3 text-sm text-text-primary">
                {overturnedMessageOf(view)}
              </blockquote>
            </>
          )}
        </DecisionPanel>
      ) : null}
      {panel === "uphold" ? (
        <DecisionPanel
          id="dispute-uphold"
          title={d.upholdTitle}
          lead={d.lead}
          problem={problem}
          busy={busy === "uphold"}
          busyNow={busyNow}
          confirmLabel={d.upholdConfirm}
          onConfirm={onUphold}
          onCancel={() => entry.setPanel(null)}
        >
          <UpholdFields
            view={view}
            draft={draft}
            problem={problem}
            outcomeCode={outcomeCode}
            onOutcome={onOutcome}
            onDraft={entry.setDraft}
          />
        </DecisionPanel>
      ) : null}
    </section>
  );
}

export function DisputeEntryScreen({ id }: { id: string }) {
  const entry = useClaimedEntry<DisputeOpenResponse, DisputePanel>(
    id,
    LIST,
    API,
    KEYS,
    "dispute",
  );
  const evidence = useVerificationEvidence(id, readDisputeEvidence);
  const [outcomeCode, setOutcomeCode] = useState<string | null>(null);
  const { perform, finish, draft, setProblem } = entry;

  function uphold(view: DisputeOpenResponse) {
    if (view.reviewToken === null) {
      return;
    }
    const checked = upholdCheck(
      draft,
      outcomeCode,
      upholdReasonsOf(view),
      view.reviewToken,
    );
    if (!checked.ok) {
      setProblem(checked.problem);
      return;
    }
    void perform(
      "uphold",
      view,
      () => upholdDisputeEntry(view.entry.id, checked.body),
      (data) => finish(view, data.next, upheldNotice(view, data.late)),
    );
  }

  function overturn(view: DisputeOpenResponse) {
    const target = overturnTargetOf(view);
    if (view.reviewToken === null || target === null) {
      return;
    }
    const checked = overturnCheck(target, draft, view.reviewToken);
    if (!checked.ok) {
      setProblem(checked.problem);
      return;
    }
    void perform(
      "overturn",
      view,
      () => overturnDisputeEntry(view.entry.id, checked.body),
      (data) => finish(view, data.next, overturnedNotice(view, data.late)),
    );
  }

  return (
    <ClaimedEntryFrame
      entry={entry}
      list={LIST}
      heading={messages.queue.verification_disputes}
      titleOf={(view) =>
        t.title(
          messages.disputeQueue.kinds[view.entry.kind],
          networkWords(view.entry.networkCode),
          levelWords(view.entry.level),
        )
      }
      subtitleOf={(view) => t.subtitle(formatDateTime(view.entry.submittedAt))}
      shortcuts={SHORTCUTS}
    >
      {(view, mode) => (
        <>
          {mode === "closed" ? <ClosedDisputeBlock view={view} /> : null}
          <ContestBlock view={view} />
          <ContestedDecisionBlock view={view} />
          {mode === "deciding" &&
          overturnTargetOf(view) === "refusal_audience" ? (
            <section
              aria-labelledby="dispute-evidence"
              className={SECTION_CLASSES}
            >
              <h2 id="dispute-evidence" className={SECTION_TITLE}>
                {t.sections.evidence}
              </h2>
              <p className={HELP_CLASSES}>{t.evidence.lead}</p>
              {(view.dossier?.evidence.length ?? 0) === 0 ? (
                <p className="text-sm text-text-primary">{t.evidence.none}</p>
              ) : (
                <EvidencePieces
                  evidence={view.dossier?.evidence ?? []}
                  pieces={evidence.pieces}
                  blocked={evidence.blocked}
                  disabled={false}
                  onOpen={(evidenceId) => void evidence.open(evidenceId)}
                  onClose={evidence.close}
                />
              )}
            </section>
          ) : null}
          {mode === "deciding" ? (
            <Decision
              entry={entry}
              view={view}
              outcomeCode={outcomeCode}
              onOutcome={setOutcomeCode}
              onUphold={() => uphold(view)}
              onOverturn={() => overturn(view)}
            />
          ) : null}
        </>
      )}
    </ClaimedEntryFrame>
  );
}
