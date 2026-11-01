"use client";

// The replay of failed contact lines (docs/mvp/05 RG101 to RG103, CA58 to CA61; 17b §3.11;
// backoffice-ops step 3): the selection is summed up BEFORE the gesture (how many, for whom), the
// cap and the reversibility are said, a typed reason is chosen, and the confirmation is a separate
// button. The report names what was put back, ignored and refused. No lock: the replay is
// idempotent (15 RG30).
import {
  REPLAY_REASONS,
  type ReplayResponse,
} from "@influx/contracts/backoffice-actions";
import { useId, useState } from "react";
import { messages } from "@/messages/fr";
import { HELP_CLASSES, LABEL_CLASSES } from "./auth-classes";
import { ActionFeedback } from "./ActionFeedback";
import { replay } from "./backoffice-api";
import {
  FIELD_CLASSES,
  SECTION_CLASSES,
  SECTION_TITLE,
  SELECT_CLASSES,
  SMALL_PRIMARY_CLASSES,
  SMALL_SECONDARY_CLASSES,
  SUCCESS_CLASSES,
} from "./bo-classes";
import { useAction } from "./use-action";
import { replayPreviewOf, type ReplayPair } from "./view-model";

type Reason = (typeof REPLAY_REASONS)[number];

export function ReplayPanel({
  pairs,
  onCancel,
  onDone,
}: {
  pairs: readonly ReplayPair[];
  onCancel: () => void;
  onDone: () => void;
}) {
  const t = messages.replay;
  const ids = { title: useId(), reason: useId() };
  const action = useAction();
  const [reason, setReason] = useState<Reason | "">("");
  const [report, setReport] = useState<ReplayResponse | null>(null);
  const { preview, overCap } = replayPreviewOf(pairs);

  function confirm() {
    if (reason === "" || action.busy) {
      return;
    }
    void action.run(
      () => replay({ items: [...pairs], reasonCode: reason }),
      (data) => setReport(data),
    );
  }

  return (
    <section aria-labelledby={ids.title} className={SECTION_CLASSES}>
      <h2 id={ids.title} className={SECTION_TITLE}>
        {t.title}
      </h2>
      {report === null ? (
        <>
          <p>{preview}</p>
          {overCap === null ? null : <p className={HELP_CLASSES}>{overCap}</p>}
          <p className={HELP_CLASSES}>{t.reversibility}</p>
          <p className={HELP_CLASSES}>{t.noConsent}</p>
          <div className={FIELD_CLASSES}>
            <label htmlFor={ids.reason} className={LABEL_CLASSES}>
              {messages.common.reason}
            </label>
            <select
              id={ids.reason}
              value={reason}
              onChange={(event) => setReason(event.target.value as Reason)}
              className={SELECT_CLASSES}
            >
              <option value="">{messages.common.reasonPlaceholder}</option>
              {REPLAY_REASONS.map((code) => (
                <option key={code} value={code}>
                  {t.reasons[code]}
                </option>
              ))}
            </select>
          </div>
          <ActionFeedback action={action} />
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={confirm}
              aria-disabled={reason === "" || action.busy || undefined}
              className={SMALL_PRIMARY_CLASSES}
            >
              {action.busy ? t.busy : t.confirm}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className={SMALL_SECONDARY_CLASSES}
            >
              {messages.common.cancel}
            </button>
          </div>
        </>
      ) : (
        <>
          <p role="status" className={SUCCESS_CLASSES}>
            {t.report(
              report.requested,
              report.requeued,
              report.ignored,
              report.refused,
            )}
          </p>
          <ul className="flex flex-col gap-1 text-sm">
            {report.items.map((item) => (
              <li key={`${item.accountId}-${item.destination}`}>
                {t.outcomeLine(
                  messages.destinations[item.destination],
                  t.outcome[item.outcome],
                )}
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={onDone}
            className={SMALL_SECONDARY_CLASSES}
          >
            {t.close}
          </button>
        </>
      )}
    </section>
  );
}
