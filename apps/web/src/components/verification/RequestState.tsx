"use client";

// The request of a level as a row of a network line shows it (docs/mvp/08 RG50, RG56, RG57, RG93;
// 17 §5.3): « Demande en cours depuis le {date} » with its clock, a draft that was never sent, a code
// that ran out, and a refusal with the text of its reason, the agent's own words when he wrote some
// and what the creator can do next. The reason is the closed list's, translated here from its code
// (the API's `message` is only the agent's own words); the internal comment, the agent and the
// figures are not in this answer (invariant 15).
import { useLocale, useTranslations } from "next-intl";
import { ErrorNotice } from "@/components/ui/ErrorNotice";
import { ClockIcon } from "@/components/ui/icons";
import { MEMBER_FIELD_HELP_CLASSES } from "@/components/member/ui/field-classes";
import {
  formatVerificationDate,
  refusalViewOf,
  type RowRequest,
} from "./verification-view";

const WAITING_CLASSES = "flex items-start gap-2 text-sm text-text-secondary";

export function RequestState({
  state,
  showPendingNote = true,
}: {
  state: RowRequest;
  /** « Nous répondons sous 1 jour ouvré » under a request sent: the journey writes it itself. */
  showPendingNote?: boolean;
}) {
  const t = useTranslations("verification");
  const locale = useLocale();
  if (state.kind === "requested" || state.kind === "started") {
    const date = formatVerificationDate(state.since, locale);
    return (
      <div className="flex flex-col gap-1" data-request={state.kind}>
        <p className={WAITING_CLASSES}>
          <ClockIcon
            aria-hidden="true"
            className="mt-1 size-(--size-icon-sm) shrink-0"
          />
          <span>
            {t(
              state.kind === "requested" ? "state.requested" : "state.started",
              { date },
            )}
          </span>
        </p>
        {state.kind === "requested" && showPendingNote ? (
          <p className={MEMBER_FIELD_HELP_CLASSES}>
            {t("verif.request.pending")}
          </p>
        ) : null}
      </div>
    );
  }
  if (state.kind === "expired") {
    return (
      <p className={WAITING_CLASSES} data-request="expired">
        <ClockIcon
          aria-hidden="true"
          className="mt-1 size-(--size-icon-sm) shrink-0"
        />
        <span>{t("verif.request.expired")}</span>
      </p>
    );
  }
  const view = refusalViewOf(state.refusal);
  return (
    <ErrorNotice announce={false} className="text-left">
      <div
        className="flex flex-col gap-2"
        data-request="refused"
        data-reason={view.reason}
      >
        <p className="font-semibold">
          {t("state.refused", {
            date: formatVerificationDate(state.refusal.decidedAt, locale),
          })}
        </p>
        <p>{t(`refusal.reason.${view.reason}`)}</p>
        {view.agentMessage === null ? null : (
          <p>
            {view.reason === "other" ? null : (
              <span className="font-semibold">
                {t("refusal.agentMessage")}{" "}
              </span>
            )}
            <span data-agent-message="">{view.agentMessage}</span>
          </p>
        )}
        <p>{t(`refusal.next.${view.next}`)}</p>
      </div>
    </ErrorNotice>
  );
}
