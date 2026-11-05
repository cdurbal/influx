"use client";

// The banners and the small panels around the decision of queue 1 (docs/mvp/17b §2.4, §2.6, §4.3; 15
// RG27 C3, C4, RG117; jalons/l2c/file.md A8, A9; L2C-17): the claim in a sentence, the reminder before
// it falls, the confirmation that stays above the next entry, the administrator's lifting of a claim
// with a typed reason. A state is always written; the tone only underlines it (RG119).
import {
  CLAIM_RELEASE_REASON_CODES,
  type ClaimReleaseReasonCode,
} from "@influx/contracts/backoffice-queues";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { messages } from "@/messages/fr";
import { HELP_CLASSES, INFO_CLASSES, WARNING_CLASSES } from "./auth-classes";
import {
  BLOCK_TITLE,
  SECTION_CLASSES,
  SMALL_PRIMARY_CLASSES,
  SMALL_SECONDARY_CLASSES,
  SUCCESS_CLASSES,
} from "./bo-classes";
import { ErrorNotice } from "./ErrorNotice";
import { CircleCheckIcon } from "./icons";
import type { Banner, ChainNotice } from "./queue-review-view";

const t = messages.queueReview;

const LIST = "/files/profils-marque";

/** A banner of the head of the screen: information is not an error (17b §2.4). */
export function StatusBanner({ banner }: { banner: Banner }) {
  return (
    <div
      role="status"
      className={banner.tone === "alert" ? WARNING_CLASSES : INFO_CLASSES}
    >
      {banner.lines.map((line) => (
        <p key={line}>{line}</p>
      ))}
    </div>
  );
}

/** The reminder three minutes before the claim falls, then the claim that fell (15 C3, A9). */
export function ExpiryBanner({
  kind,
  minutes,
  busy,
  onExtend,
  onResume,
}: {
  kind: "soon" | "expired";
  minutes: number;
  busy: boolean;
  onExtend: () => void;
  onResume: () => void;
}) {
  return (
    <div
      role="status"
      className={`${kind === "soon" ? INFO_CLASSES : WARNING_CLASSES} flex flex-wrap items-center gap-3`}
    >
      <p>
        {kind === "soon" ? t.banner.expiresSoon(minutes) : t.banner.expired}
      </p>
      <button
        type="button"
        aria-disabled={busy || undefined}
        onClick={() => {
          if (!busy) {
            (kind === "soon" ? onExtend : onResume)();
          }
        }}
        className={SMALL_SECONDARY_CLASSES}
      >
        {kind === "soon" ? t.banner.extend : t.banner.resume}
      </button>
    </div>
  );
}

/**
 * 17b §2.6: after a decision the next entry opens, taken in charge, and this confirmation stays above
 * it (RG117: at least six seconds; here until it is closed, which is longer). With nothing left in
 * the queue, the decision screen ends on the empty state of the queue.
 */
export function ChainBanner({
  notice,
  empty,
  busy,
  onCancel,
  onClose,
}: {
  notice: ChainNotice;
  empty: boolean;
  busy: boolean;
  onCancel: () => void;
  onClose: () => void;
}) {
  return (
    <div role="status" className={`${SUCCESS_CLASSES} flex flex-col gap-2`}>
      <p className="flex items-start gap-2 font-semibold">
        <CircleCheckIcon
          aria-hidden="true"
          className="size-(--size-icon-md) shrink-0"
        />
        <span>{notice.lines[0]}</span>
      </p>
      {notice.lines.slice(1).map((line) => (
        <p key={line}>{line}</p>
      ))}
      {empty ? (
        <>
          <p>{t.chain.empty}</p>
          <Link href={LIST} className={`${SMALL_SECONDARY_CLASSES} self-start`}>
            {t.chain.emptyBack}
          </Link>
        </>
      ) : (
        <div className="flex flex-wrap gap-3">
          <Link
            href={`${LIST}/${notice.decidedEntry}`}
            className={SMALL_SECONDARY_CLASSES}
          >
            {t.chain.seeEntry}
          </Link>
          <button
            type="button"
            aria-disabled={busy || undefined}
            onClick={() => {
              if (!busy) {
                onCancel();
              }
            }}
            className={SMALL_SECONDARY_CLASSES}
          >
            {t.chain.cancel}
          </button>
          <button
            type="button"
            onClick={onClose}
            className={SMALL_SECONDARY_CLASSES}
          >
            {t.chain.close}
          </button>
        </div>
      )}
    </div>
  );
}

/** 15 C4: an administrator lifts a live claim with a typed reason; the holder is told, the lifting logged. */
export function ForceReleasePanel({
  reason,
  problem,
  busy,
  onReason,
  onConfirm,
  onCancel,
}: {
  reason: ClaimReleaseReasonCode | null;
  problem: string | null;
  busy: boolean;
  onReason: (next: ClaimReleaseReasonCode) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const panel = useRef<HTMLFormElement>(null);
  useEffect(() => {
    panel.current
      ?.querySelector<HTMLInputElement>("input[type=radio]")
      ?.focus();
  }, []);
  return (
    <form
      ref={panel}
      noValidate
      aria-labelledby="review-force-title"
      onSubmit={(event) => {
        event.preventDefault();
        if (!busy) {
          onConfirm();
        }
      }}
      className={SECTION_CLASSES}
    >
      <h3 id="review-force-title" className={BLOCK_TITLE}>
        {t.force.title}
      </h3>
      <p className={HELP_CLASSES}>{t.force.lead}</p>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-semibold text-text-primary">
          {t.force.legend}
        </legend>
        {CLAIM_RELEASE_REASON_CODES.map((code) => (
          <label
            key={code}
            className="flex min-h-(--size-bo-control) items-center gap-2 text-sm text-text-primary"
          >
            <input
              type="radio"
              name="claim-release-reason"
              value={code}
              checked={reason === code}
              onChange={() => onReason(code)}
              className="size-(--size-checkbox)"
            />
            {t.force.reasons[code]}
          </label>
        ))}
      </fieldset>
      {problem === null ? null : <ErrorNotice>{problem}</ErrorNotice>}
      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          aria-disabled={busy || undefined}
          className={SMALL_PRIMARY_CLASSES}
        >
          {busy ? messages.queueReview.decision.busy : t.force.confirm}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className={SMALL_SECONDARY_CLASSES}
        >
          {t.decision.cancel}
        </button>
      </div>
    </form>
  );
}
