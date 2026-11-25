"use client";

// The decision screen of queue 1, "Profils marque à valider" (docs/mvp/06 RG6, RG9, RG65, RG66; 15 RG27
// C1 to C8, RG36, RG114 to RG117; 17b §2.4 to §2.6, §4.3, §4.8, §4.11; jalons/l2c/file.md A3, A6, A8,
// A9, A10; L2C-17). Opening is claiming (C1): the page calls POST …/open when it appears, and the
// journal of apps/api keeps the opening. Three modes: it decides (the claim is the caller's), it reads
// (a colleague holds the entry: a sentence, never an error screen), or the entry is closed. It only
// draws: the state and the calls are `use-review-entry.ts`, the wording and the checks are
// `queue-review-view.ts` and `queue-review-facts.ts`; the database and apps/api decide.
import Link from "next/link";
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
  claimBanner,
  expiryOf,
  forcedReleaseNotice,
  loggedLine,
  modeOf,
  overdueBanner,
} from "./queue-review-view";
import {
  AlertsBlock,
  BrandBlock,
  ClosedBlock,
  ContactBlock,
  WrittenBlock,
} from "./ReviewBlocks";
import {
  ChainBanner,
  ExpiryBanner,
  ForceReleasePanel,
  StatusBanner,
} from "./ReviewBanners";
import { ReviewDecision } from "./ReviewDecision";
import { useMe } from "./Shell";
import { REVIEW_LIST, useReviewEntry } from "./use-review-entry";
import { formatDateTime } from "./view-model";

const t = messages.queueReview;

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
          aria-controls="review-shortcuts"
          onClick={onToggle}
          className={SMALL_SECONDARY_CLASSES}
        >
          {t.shortcuts.button}
        </button>
      </div>
      {open ? (
        <section
          id="review-shortcuts"
          aria-labelledby="review-shortcuts-title"
          className={SECTION_CLASSES}
        >
          <h2 id="review-shortcuts-title" className={SECTION_TITLE}>
            {t.shortcuts.title}
          </h2>
          <dl className={DL_CLASSES}>
            {(
              [
                ["v", t.shortcuts.publish],
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

export function BrandReviewEntryScreen({ id }: { id: string }) {
  const me = useMe();
  const entry = useReviewEntry(id);
  const { screen, panel, problem, busy } = entry;

  if (entry.done !== null) {
    return (
      <>
        <h1 className={TITLE_CLASSES}>{messages.queue.profiles_advertiser}</h1>
        <ChainBanner
          notice={entry.done}
          empty
          busy={false}
          onCancel={() => undefined}
          onClose={() => undefined}
        />
      </>
    );
  }

  if (screen.kind === "loading") {
    return (
      <>
        <h1 className={TITLE_CLASSES}>{messages.queue.profiles_advertiser}</h1>
        <p role="status" className={HELP_CLASSES}>
          {t.loading}
        </p>
      </>
    );
  }

  if (screen.kind === "failed") {
    return (
      <>
        <h1 className={TITLE_CLASSES}>{messages.queue.profiles_advertiser}</h1>
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
          <Link href={REVIEW_LIST} className={SMALL_SECONDARY_CLASSES}>
            {t.back}
          </Link>
        </div>
      </>
    );
  }

  const { view, offsetMs, notice, changes } = screen;
  const mode = modeOf(view);
  const claim = claimBanner(view);
  const overdue = overdueBanner(view);
  const lifted = forcedReleaseNotice(view);
  const expiry = expiryOf(view, entry.now, offsetMs);
  const due =
    view.entry.state === "open" ? dueWords(view.entry, view.asOf) : null;
  const isAdmin = me.role === "admin";
  const busyNow = busy !== null;

  return (
    <>
      {entry.chain === null ? null : (
        <ChainBanner
          notice={entry.chain}
          empty={false}
          busy={busyNow}
          onCancel={() => entry.cancelChain(view)}
          onClose={entry.closeChain}
        />
      )}
      <h1 className={TITLE_CLASSES}>
        {t.title(view.profile.brandName)}
        <span aria-hidden="true"> {t.mark}</span>
        <span className="sr-only"> {t.parenthesized(t.markerLabel)}</span>
      </h1>
      <p className={LEAD_CLASSES}>
        {t.subtitle(
          messages.queueList.kinds[view.entry.kind],
          formatDateTime(view.entry.createdAt),
        )}
        {due === null ? null : (
          <span className="tabular-nums">
            {t.separator}
            <span className={due.overdue ? "font-bold" : undefined}>
              {due.text}
            </span>
            {t.separator}
            {due.at}
          </span>
        )}
      </p>
      <p className={HELP_CLASSES}>{loggedLine(view, me.email)}</p>

      <div className="flex flex-wrap items-center gap-3">
        <Link href={REVIEW_LIST} className={SMALL_SECONDARY_CLASSES}>
          {t.back}
        </Link>
        {mode === "deciding" ? (
          <button
            type="button"
            aria-keyshortcuts="l"
            aria-disabled={busyNow || undefined}
            onClick={() => {
              if (!busyNow) {
                entry.release(view);
              }
            }}
            className={SMALL_SECONDARY_CLASSES}
          >
            {t.decision.release}
            <span aria-hidden="true" className="ml-2">
              {t.keyReleaseHint}
            </span>
          </button>
        ) : null}
        {mode === "readOnly" && isAdmin && view.entry.state === "open" ? (
          <button
            type="button"
            aria-expanded={panel === "force"}
            onClick={() => entry.setPanel(panel === "force" ? null : "force")}
            className={SMALL_SECONDARY_CLASSES}
          >
            {t.force.button}
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
      {changes === null ? null : (
        <StatusBanner
          banner={{
            tone: "alert",
            lines: [t.modifiedAfterLine(changes.labels.join(", "))],
          }}
        />
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

      {mode === "closed" ? <ClosedBlock view={view} /> : null}
      <BrandBlock view={view} changes={changes} />
      <WrittenBlock view={view} changes={changes} />
      <AlertsBlock view={view} />
      <ContactBlock view={view} />

      {mode === "deciding" ? (
        <ReviewDecision
          view={view}
          draft={entry.draft}
          problem={panel === "force" ? null : problem}
          busy={busy === "publish" || busy === "reject"}
          panel={panel === "publish" || panel === "reject" ? panel : null}
          onPanel={(next) => {
            entry.setProblem(null);
            entry.setPanel(next);
          }}
          onDraft={entry.setDraft}
          onPublish={() => entry.publish(view)}
          onReject={() => entry.reject(view)}
        />
      ) : mode === "readOnly" ? (
        <section aria-labelledby="review-readonly" className={SECTION_CLASSES}>
          <h2 id="review-readonly" className={SECTION_TITLE}>
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
