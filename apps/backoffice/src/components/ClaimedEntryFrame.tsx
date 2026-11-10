"use client";

// The frame of the decision screens of queues 5 and 6 (docs/mvp/08 RG77, RG78, RG98; 15 RG27 C1 to C8; 17b
// §2.4 to §2.6; jalons/l2f, commit 19): the title, the logged opening, the claim in a sentence, the reminder
// before it falls, the lifting of a claim by an administrator, the confirmation before the typed work is
// dropped, the chain to the next entry, the shortcuts. What is inside (the dossier and the two decisions) is
// the screen's own, given as `children`. It only draws: the state and the calls are `use-claimed-entry.ts`.
import Link from "next/link";
import type { ReactNode } from "react";
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
import {
  claimedBanner,
  claimedExpiryOf,
  claimedForcedNotice,
  claimedLoggedLine,
  claimedModeOf,
  claimedOverdueBanner,
  type ClaimedMode,
  type ClaimedView,
} from "./claimed-entry-view";
import { ErrorNotice } from "./ErrorNotice";
import { dueWords } from "./queue-view-model";
import {
  ChainBanner,
  ExpiryBanner,
  ForceReleasePanel,
  StatusBanner,
} from "./ReviewBanners";
import { useMe } from "./Shell";
import type { useClaimedEntry } from "./use-claimed-entry";
import { VerificationReleasePanel } from "./VerificationReleasePanel";

const t = messages.claimedReview;

/** What `useClaimedEntry` returns, for the screen that draws it. */
export type ClaimedController<
  View extends ClaimedView,
  Decision extends string,
> = ReturnType<typeof useClaimedEntry<View, Decision>>;

export type ShortcutRows = {
  keys: string;
  rows: readonly (readonly [string, string])[];
};

function Shortcuts({
  words,
  open,
  onToggle,
}: {
  words: ShortcutRows;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <p className={HELP_CLASSES}>{words.keys}</p>
        <button
          type="button"
          aria-expanded={open}
          aria-controls="claimed-shortcuts"
          onClick={onToggle}
          className={SMALL_SECONDARY_CLASSES}
        >
          {t.shortcuts.button}
        </button>
      </div>
      {open ? (
        <section
          id="claimed-shortcuts"
          aria-labelledby="claimed-shortcuts-title"
          className={SECTION_CLASSES}
        >
          <h2 id="claimed-shortcuts-title" className={SECTION_TITLE}>
            {t.shortcuts.title}
          </h2>
          <dl className={DL_CLASSES}>
            {words.rows.map(([key, meaning]) => (
              <div key={key} className="contents">
                <dt className={DT_CLASSES}>
                  <kbd className={CODE_TEXT_CLASSES}>{key}</kbd>
                </dt>
                <dd className={DD_CLASSES}>{meaning}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}
    </>
  );
}

export function ClaimedEntryFrame<
  View extends ClaimedView,
  Decision extends string,
>({
  entry,
  list,
  heading,
  titleOf,
  subtitleOf,
  shortcuts,
  children,
}: {
  entry: ClaimedController<View, Decision>;
  /** The address of the queue's list: the way back and the end of the chain. */
  list: string;
  /** The title of the queue, over the states that have no entry to name yet. */
  heading: string;
  titleOf: (view: View) => string;
  subtitleOf: (view: View) => string;
  shortcuts: ShortcutRows;
  children: (view: View, mode: ClaimedMode) => ReactNode;
}) {
  const me = useMe();
  const { screen, panel, problem, busy } = entry;

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
  const mode = claimedModeOf(view);
  const claim = claimedBanner(view);
  const overdue = claimedOverdueBanner(view);
  const lifted = claimedForcedNotice(view);
  const expiry = claimedExpiryOf(view, entry.now, offsetMs);
  const due =
    view.entry.state === "open" ? dueWords(view.entry, view.asOf) : null;
  const busyNow = busy !== null;

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
        {subtitleOf(view)}
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
      <p className={HELP_CLASSES}>{claimedLoggedLine(view, me.email)}</p>

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
            {t.release}
            <span aria-hidden="true" className="ml-2">
              {messages.queueReview.keyReleaseHint}
            </span>
          </button>
        ) : null}
        {mode === "readOnly" && me.role === "admin" ? (
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

      {children(view, mode)}

      {mode === "readOnly" ? (
        <section aria-labelledby="claimed-readonly" className={SECTION_CLASSES}>
          <h2 id="claimed-readonly" className={SECTION_TITLE}>
            {messages.queueReview.sections.decision}
          </h2>
          <p className="text-sm text-text-primary">{t.readOnly}</p>
        </section>
      ) : null}

      {problem !== null && mode !== "deciding" && panel !== "force" ? (
        <ErrorNotice>{problem.text}</ErrorNotice>
      ) : null}

      <Shortcuts
        words={shortcuts}
        open={panel === "help"}
        onToggle={() => entry.setPanel(panel === "help" ? null : "help")}
      />
    </>
  );
}
