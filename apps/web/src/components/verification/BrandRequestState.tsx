"use client";

// The brand's one request as block 4 and the journey show it (docs/mvp/06 RG50, RG52, RG56, RG57, RG59;
// 17 §4.2): « Demande en cours depuis le {date} », a draft never sent, a code that ran out, and a refusal
// with the text of its reason, the agent's own words when he wrote some and what the brand can do next.
// The waiting states are the creator's (RequestState); the refusal is told by the brand's closed list
// (`l2e/modele.md` §5), translated here from its code: the API's `message` is only the agent's own words
// (`other`). The internal comment, the agent and the registration are not in this answer.
import { useLocale, useTranslations } from "next-intl";
import { ErrorNotice } from "@/components/ui/ErrorNotice";
import { brandRefusalViewOf } from "./brand-verification-view";
import { RequestState } from "./RequestState";
import { formatVerificationDate, type RowRequest } from "./verification-view";

export function BrandRequestState({
  state,
  showPendingNote = true,
}: {
  state: RowRequest;
  /** « Nous répondons sous 1 jour ouvré » under a request sent: the journey writes it itself. */
  showPendingNote?: boolean;
}) {
  const t = useTranslations("verification");
  const locale = useLocale();
  if (state.kind !== "refused") {
    return <RequestState state={state} showPendingNote={showPendingNote} />;
  }
  const view = brandRefusalViewOf(state.refusal);
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
        <p>{t(`brand.refusal.reason.${view.reason}`)}</p>
        {view.agentMessage === null ? null : (
          <p data-agent-message="">{view.agentMessage}</p>
        )}
        <p>
          {view.next === "contact"
            ? t("refusal.next.contact")
            : t(`brand.refusal.next.${view.next}`)}
        </p>
      </div>
    </ErrorNotice>
  );
}
