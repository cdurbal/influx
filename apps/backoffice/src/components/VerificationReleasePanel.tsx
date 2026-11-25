"use client";

// The confirmation before the request is given back with work typed on the screen (docs/mvp/17b §2.6;
// 08 RG98; jalons/l2e, L2EU-7): what the agent typed lives nowhere else, so «l» and « Je rends la main »
// open this panel as «v» and «r» open theirs, and only the confirmation drops it. « Garder la demande »
// and «Échap» close it without loss; the focus lands on the safe choice.
import { useEffect, useRef } from "react";
import { messages } from "@/messages/fr";
import { HELP_CLASSES } from "./auth-classes";
import {
  BLOCK_TITLE,
  SECTION_CLASSES,
  SMALL_PRIMARY_CLASSES,
  SMALL_SECONDARY_CLASSES,
} from "./bo-classes";

const t = messages.verificationReview.release;

export function VerificationReleasePanel({
  busy,
  onConfirm,
  onKeep,
}: {
  busy: boolean;
  onConfirm: () => void;
  onKeep: () => void;
}) {
  const keep = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    keep.current?.focus();
  }, []);
  return (
    <section
      aria-labelledby="verification-release-title"
      className={SECTION_CLASSES}
    >
      <h3 id="verification-release-title" className={BLOCK_TITLE}>
        {t.title}
      </h3>
      <p className={HELP_CLASSES}>{t.lead}</p>
      <div className="flex flex-wrap gap-3">
        <button
          ref={keep}
          type="button"
          onClick={onKeep}
          className={SMALL_PRIMARY_CLASSES}
        >
          {t.keep}
        </button>
        <button
          type="button"
          aria-disabled={busy || undefined}
          onClick={() => {
            if (!busy) {
              onConfirm();
            }
          }}
          className={SMALL_SECONDARY_CLASSES}
        >
          {busy ? messages.queueReview.decision.busy : t.confirm}
        </button>
      </div>
    </section>
  );
}
