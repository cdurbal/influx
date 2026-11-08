"use client";

// The decision screen of a verification request, queue 4, in either view: "Vérifications des créateurs"
// (docs/mvp/08 RG43 to RG59, RG64, RG98, CA25 to CA33; 17b §3.7; jalons/l2e/modele.md §4, §6; L2E-22) or
// "Vérifications des marques" (06 RG46 to RG52, RG61; L2E-23: its own blocks, none of the creator's pieces
// or figures). Opening is claiming: the page calls POST …/open when it appears, and the register of apps/api keeps the opening.
// Everything the decision needs is on this one screen (RG55): the request, the pieces opened one by one,
// the procedure, what the agent types, the decision. Three modes: it decides (the claim is the caller's),
// it reads (a colleague holds the request: a sentence, never an error screen, and no dossier), or the
// request is closed. It only draws: the state and the calls are `use-verification-entry.ts`, the wording
// and the checks `verification-decision-view.ts`; the database and apps/api decide.
import Link from "next/link";
import type { VerificationQueueView } from "@influx/contracts/verification";
import { messages } from "@/messages/fr";
import {
  CODE_TEXT_CLASSES,
  HELP_CLASSES,
  LEAD_CLASSES,
  TITLE_CLASSES,
} from "./auth-classes";
import {
  DD_CLASSES,
  DL_CLASSES,
  DT_CLASSES,
  SECTION_CLASSES,
  SECTION_TITLE,
  SMALL_SECONDARY_CLASSES,
} from "./bo-classes";
import { ErrorNotice } from "./ErrorNotice";
import { dueWords } from "./queue-view-model";
import {
  ChainBanner,
  ExpiryBanner,
  ForceReleasePanel,
  StatusBanner,
} from "./ReviewBanners";
import { useMe } from "./Shell";
import { useVerificationEntry } from "./use-verification-entry";
import {
  BrandProcedureBlock,
  BrandRecordBlock,
  BrandRequestBlock,
} from "./VerificationBrandBlocks";
import { VerificationDecision } from "./VerificationDecision";
import {
  claimBanner,
  expiryOf,
  forcedReleaseNotice,
  isAudience,
  isBrand,
  loggedLine,
  modeOf,
  overdueBanner,
  titleOf,
} from "./verification-decision-view";
import { ClosedBlock, RequestBlock } from "./VerificationDossierBlocks";
import { EvidenceBlock, ProcedureBlock } from "./VerificationEvidenceBlocks";
import { VERIFICATION_VIEW_ADDRESS } from "./verification-queue-view";
import { RecordBlock } from "./VerificationRecordBlock";
import { VerificationReleasePanel } from "./VerificationReleasePanel";
import { formatDateTime } from "./view-model";

const t = messages.verificationReview;

function Shortcuts({
  open,
  onToggle,
}: {
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <p className={HELP_CLASSES}>{t.shortcuts.keys}</p>
        <button
          type="button"
          aria-expanded={open}
          aria-controls="verification-shortcuts"
          onClick={onToggle}
          className={SMALL_SECONDARY_CLASSES}
        >
          {t.shortcuts.button}
        </button>
      </div>
      {open ? (
        <section
          id="verification-shortcuts"
          aria-labelledby="verification-shortcuts-title"
          className={SECTION_CLASSES}
        >
          <h2 id="verification-shortcuts-title" className={SECTION_TITLE}>
            {t.shortcuts.title}
          </h2>
          <dl className={DL_CLASSES}>
            {(
              [
                ["v", t.shortcuts.grant],
                ["r", t.shortcuts.reject],
                ["l", t.shortcuts.release],
                ["Échap", t.shortcuts.escape],
                ["?", t.shortcuts.help],
              ] as const
            ).map(([key, words]) => (
              <div key={key} className="contents">
                <dt className={DT_CLASSES}>
                  <kbd className={CODE_TEXT_CLASSES}>{key}</kbd>
                </dt>
                <dd className={DD_CLASSES}>{words}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}
    </>
  );
}

export function VerificationEntryScreen({
  id,
  view: queue,
}: {
  id: string;
  view: VerificationQueueView;
}) {
  const me = useMe();
  const list = VERIFICATION_VIEW_ADDRESS[queue];
  const entry = useVerificationEntry(id, queue, list);
  const { screen, panel, problem, busy, evidence } = entry;
  const heading =
    queue === "brands"
      ? messages.queue.verification_brands
      : messages.queue.verification_creators;

  if (entry.done !== null) {
    return (
      <>
        <h1 className={TITLE_CLASSES}>{heading}</h1>
        <ChainBanner
          notice={entry.done}
          empty
          busy={false}
          list={list}
          onCancel={() => undefined}
          onClose={() => undefined}
        />
      </>
    );
  }

  if (screen.kind === "loading") {
    return (
      <>
        <h1 className={TITLE_CLASSES}>{heading}</h1>
        <p role="status" className={HELP_CLASSES}>
          {t.loading}
        </p>
      </>
    );
  }

  if (screen.kind === "failed") {
    return (
      <>
        <h1 className={TITLE_CLASSES}>{heading}</h1>
        <ErrorNotice>{screen.text}</ErrorNotice>
        <div className="flex flex-wrap gap-3">
          {screen.retry ? (
            <button
              type="button"
              onClick={entry.retryOpening}
              className={SMALL_SECONDARY_CLASSES}
            >
              {messages.common.retry}
            </button>
          ) : null}
          <Link href={list} className={SMALL_SECONDARY_CLASSES}>
            {t.back}
          </Link>
        </div>
      </>
    );
  }

  const { view, offsetMs, notice } = screen;
  const mode = modeOf(view);
  const claim = claimBanner(view);
  const overdue = overdueBanner(view);
  const lifted = forcedReleaseNotice(view);
  const expiry = expiryOf(view, entry.now, offsetMs);
  const due =
    view.entry.status === "pending" ? dueWords(view.entry, view.asOf) : null;
  const isAdmin = me.role === "admin";
  const busyNow = busy !== null;
  const audience = isAudience(view);
  const brand = isBrand(view);
  const decisionPanel =
    panel === "grant" || panel === "reject" || panel === "reexamine"
      ? panel
      : null;

  return (
    <>
      {entry.chain === null ? null : (
        <ChainBanner
          notice={entry.chain}
          empty={false}
          busy={busyNow}
          list={list}
          onCancel={() => entry.cancelChain(view)}
          onClose={entry.closeChain}
        />
      )}
      <h1 className={TITLE_CLASSES}>
        {titleOf(view)}
        <span aria-hidden="true"> {messages.queueReview.mark}</span>
        <span className="sr-only">
          {" "}
          {messages.queueReview.parenthesized(messages.queueReview.markerLabel)}
        </span>
      </h1>
      <p className={LEAD_CLASSES}>
        {t.subtitle(formatDateTime(view.entry.submittedAt))}
        {due === null ? null : (
          <span className="tabular-nums">
            {messages.queueReview.separator}
            <span className={due.overdue ? "font-bold" : undefined}>
              {due.text}
            </span>
            {messages.queueReview.separator}
            {due.at}
          </span>
        )}
      </p>
      <p className={HELP_CLASSES}>{loggedLine(view, me.email)}</p>

      <div className="flex flex-wrap items-center gap-3">
        <Link href={list} className={SMALL_SECONDARY_CLASSES}>
          {t.back}
        </Link>
        {mode === "deciding" ? (
          <button
            type="button"
            aria-keyshortcuts="l"
            aria-disabled={busyNow || undefined}
            onClick={() => {
              if (!busyNow) {
                entry.askRelease(view);
              }
            }}
            className={SMALL_SECONDARY_CLASSES}
          >
            {t.decision.release}
            <span aria-hidden="true" className="ml-2">
              {messages.queueReview.keyReleaseHint}
            </span>
          </button>
        ) : null}
        {mode === "readOnly" && isAdmin ? (
          <button
            type="button"
            aria-expanded={panel === "force"}
            onClick={() => entry.setPanel(panel === "force" ? null : "force")}
            className={SMALL_SECONDARY_CLASSES}
          >
            {messages.queueReview.force.button}
          </button>
        ) : null}
      </div>

      {claim === null ? null : <StatusBanner banner={claim} />}
      {overdue === null ? null : <StatusBanner banner={overdue} />}
      {lifted === null ? null : (
        <StatusBanner banner={{ tone: "info", lines: [lifted] }} />
      )}
      {expiry.kind === "soon" || expiry.kind === "expired" ? (
        <ExpiryBanner
          kind={expiry.kind}
          minutes={expiry.kind === "soon" ? expiry.minutes : 0}
          busy={busyNow}
          onExtend={() => entry.extend(view)}
          onResume={() => entry.resume(view)}
        />
      ) : null}
      {notice === null ? null : (
        <StatusBanner banner={{ tone: "info", lines: [notice] }} />
      )}

      {panel === "force" && mode === "readOnly" ? (
        <ForceReleasePanel
          reason={entry.forceReason}
          problem={problem?.text ?? null}
          busy={busy === "force"}
          onReason={entry.setForceReason}
          onConfirm={() => entry.forceRelease(view)}
          onCancel={() => entry.setPanel(null)}
        />
      ) : null}

      {panel === "release" && mode === "deciding" ? (
        <VerificationReleasePanel
          busy={busy === "release"}
          onConfirm={() => entry.release(view)}
          onKeep={() => entry.setPanel(null)}
        />
      ) : null}

      {mode === "closed" ? <ClosedBlock view={view} /> : null}
      {brand ? <BrandRequestBlock view={view} /> : <RequestBlock view={view} />}

      {mode === "deciding" ? (
        <>
          {audience ? (
            <EvidenceBlock
              view={view}
              pieces={evidence.pieces}
              blocked={evidence.blocked}
              onOpen={(evidenceId) => void evidence.open(evidenceId)}
              onClose={evidence.close}
            />
          ) : null}
          {brand ? (
            <>
              <BrandProcedureBlock view={view} />
              <BrandRecordBlock
                view={view}
                draft={entry.draft}
                problem={panel === "force" ? null : problem}
                onDraft={entry.setDraft}
              />
            </>
          ) : (
            <>
              <ProcedureBlock view={view} />
              <RecordBlock
                view={view}
                draft={entry.draft}
                problem={panel === "force" ? null : problem}
                comparison={entry.comparison}
                busy={busyNow}
                comparing={busy === "compare"}
                onDraft={entry.setDraft}
                onCompare={() => entry.compare(view)}
              />
            </>
          )}
          <VerificationDecision
            view={view}
            draft={entry.draft}
            problem={panel === "force" ? null : problem}
            busy={busyNow}
            busyKind={
              busy === "grant" || busy === "reject" || busy === "reexamine"
                ? busy
                : null
            }
            panel={decisionPanel}
            onPanel={(next) => {
              entry.setProblem(null);
              entry.setPanel(next);
            }}
            onDraft={entry.setDraft}
            onOpenGrant={() => entry.openGrant(view)}
            onGrant={() => entry.grant(view)}
            onReject={() => entry.reject(view)}
            onReexamine={() => entry.reexamine(view)}
          />
        </>
      ) : mode === "readOnly" ? (
        <section
          aria-labelledby="verification-readonly"
          className={SECTION_CLASSES}
        >
          <h2 id="verification-readonly" className={SECTION_TITLE}>
            {t.sections.decision}
          </h2>
          <p className="text-sm text-text-primary">{t.decision.readOnly}</p>
        </section>
      ) : null}

      {problem !== null && mode !== "deciding" && panel !== "force" ? (
        <ErrorNotice>{problem.text}</ErrorNotice>
      ) : null}

      <Shortcuts
        open={panel === "help"}
        onToggle={() => entry.setPanel(panel === "help" ? null : "help")}
      />
    </>
  );
}
