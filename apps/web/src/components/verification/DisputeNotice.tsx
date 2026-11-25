"use client";

// What a row of a network line says of the decisions a creator may contest and of the contests he filed
// (docs/mvp/08 RG73, RG77, CA52, CA53; 17 §5.3; jalons/l2f/modele.md §1 points 7 to 9, l2f/textes.md; commit
// 17): a badge withdrawn, with its reason (INFLUX's apologies when it was its own error, never an accusation)
// and the agent's own message where the reason asks for one; the window to contest it, written; the way to
// the contest; then the follow-up of a contest and its outcome. No decider, no agent, no deadline of the
// queue, no figure appears here: the API does not serve them. This component only writes what the API gave
// and the translation files say; the rules are dispute-view.ts's.
import type {
  ContestableDecision,
  CreatorVerificationLevel,
  CreatorVerificationLine,
  OwnDispute,
  OwnDisputesResponse,
} from "@influx/contracts/verification";
import { useLocale, useTranslations } from "next-intl";
import { memberButtonClasses } from "@/components/member/ui/button-classes";
import { ErrorNotice } from "@/components/ui/ErrorNotice";
import { Link } from "@/i18n/navigation";
import { routing, type AppLocale } from "@/i18n/routing";
import { appealHref, type AppealTarget } from "@/lib/member-paths";
import {
  contestablesOfRow,
  latestDisputeOfRow,
  outcomeViewOf,
  revocationViewOf,
  targetOfDecision,
} from "./dispute-view";
import { formatVerificationDate } from "./verification-view";

function localeOf(value: string): AppLocale {
  return (
    routing.locales.find((candidate) => candidate === value) ??
    routing.defaultLocale
  );
}

/** The way to the contest of a decision, written as an action on the network it concerns. */
function AppealLink({
  target,
  network,
  label,
}: {
  target: AppealTarget;
  network: string;
  label: "appeal.cta" | "appeal.see";
}) {
  const t = useTranslations("verification");
  const locale = localeOf(useLocale());
  return (
    <div>
      <Link
        href={appealHref(target, locale)}
        className={memberButtonClasses("secondary")}
        data-appeal-link={target.kind}
      >
        {t(label)}
        <span className="sr-only"> {t("line.cta.on", { network })}</span>
      </Link>
    </div>
  );
}

/** What a withdrawal says: « Votre badge a été retiré : {motif} », the agent's own message where there is one (RG73). */
export function RevocationText({
  decision,
}: {
  decision: Extract<ContestableDecision, { kind: "revocation" }>;
}) {
  const t = useTranslations("verification");
  const view = revocationViewOf(decision);
  return (
    <div className="flex flex-col gap-2" data-revocation={view.reason}>
      <p className="font-semibold">
        {t("verif.revoked.notice", {
          reason: t(`revocation.reason.${view.reason}`),
        })}
      </p>
      {view.message === null ? null : (
        <p>
          <span className="font-semibold">{t("refusal.agentMessage")} </span>
          <span data-agent-message="">{view.message}</span>
        </p>
      )}
    </div>
  );
}

/** A decision the creator may still contest: its window written, in days, and the way to the contest. */
function ContestableNotice({
  decision,
  network,
  windowDays,
}: {
  decision: ContestableDecision;
  network: string;
  windowDays: number;
}) {
  const t = useTranslations("verification");
  const window = (
    <p data-appeal-window="">{t("appeal.window", { days: windowDays })}</p>
  );
  const link = (
    <AppealLink
      target={targetOfDecision(decision)}
      network={network}
      label="appeal.cta"
    />
  );
  if (decision.kind === "refusal") {
    // the refusal itself is written by the request of the row; only what can be done about it is added here
    return (
      <div className="flex flex-col gap-2" data-contestable="refusal">
        {window}
        {link}
      </div>
    );
  }
  return (
    <ErrorNotice announce={false} className="text-left">
      <div className="flex flex-col gap-3" data-contestable="revocation">
        <RevocationText decision={decision} />
        {window}
        {link}
      </div>
    </ErrorNotice>
  );
}

/** The outcome of a contest, as its sentence says it (RG77 « notifié de l'issue avec un motif », CA53). */
export function OutcomeSentence({
  dispute,
  lines,
}: {
  dispute: OwnDispute;
  lines: readonly CreatorVerificationLine[];
}) {
  const t = useTranslations("verification");
  const locale = useLocale();
  const view = outcomeViewOf(dispute, lines);
  if (view === null) {
    return null;
  }
  switch (view.key) {
    case "decision_confirmed":
      return (
        <p data-outcome={view.key}>
          {t("appeal.outcome.decision_confirmed", {
            reason: t(`refusal.reason.${view.reason}`),
          })}
        </p>
      );
    case "decision_confirmedBare":
      return (
        <p data-outcome={view.key}>
          {t("appeal.outcome.decision_confirmedBare")}
        </p>
      );
    case "new_request_needed":
      return (
        <p data-outcome={view.key}>{t("appeal.outcome.new_request_needed")}</p>
      );
    case "other":
      return (
        <p data-outcome={view.key}>
          {t("appeal.outcome.other")}{" "}
          <span data-agent-message="">{view.message}</span>
        </p>
      );
    case "decision_overturned":
      return (
        <p data-outcome={view.key}>
          {t("appeal.outcome.decision_overturned", {
            badge: t(`appeal.badgeName.${view.level}`),
            date: formatVerificationDate(view.decidedAt, locale),
          })}
        </p>
      );
  }
}

/** Where a contest stands: waiting for the team, decided with its outcome, or without an object any more. */
function DisputeFollowUp({
  dispute,
  lines,
  network,
}: {
  dispute: OwnDispute;
  lines: readonly CreatorVerificationLine[];
  network: string;
}) {
  const t = useTranslations("verification");
  const locale = useLocale();
  const target: AppealTarget =
    dispute.requestId !== null
      ? { kind: "refusal", requestId: dispute.requestId }
      : { kind: "revocation", badgeId: dispute.badgeId ?? "" };
  return (
    <div className="flex flex-col gap-2" data-dispute={dispute.state}>
      {dispute.state === "open" ? (
        <p>
          {t("appeal.state.open", {
            date: formatVerificationDate(dispute.submittedAt, locale),
          })}
        </p>
      ) : dispute.state === "withdrawn" ? (
        <p>{t("appeal.state.withdrawn")}</p>
      ) : (
        <OutcomeSentence dispute={dispute} lines={lines} />
      )}
      <AppealLink target={target} network={network} label="appeal.see" />
    </div>
  );
}

/**
 * The contests of one level of a network line: the decisions still contestable, then the latest contest
 * with its follow-up. Nothing when the contests could not be read (null): the row stays as it was.
 */
export function RowDisputes({
  disputes,
  lines,
  networkCode,
  level,
  network,
  shownRequestId,
}: {
  disputes: OwnDisputesResponse | null;
  lines: readonly CreatorVerificationLine[];
  networkCode: string;
  level: CreatorVerificationLevel;
  network: string;
  /** The request the row writes, for the refusal it already says. */
  shownRequestId: string | null;
}) {
  // A withdrawal is told wherever its badge was; a refusal only on the row that writes it: a request asked
  // since says the line's state, and the refusal before it is no longer what the creator reads there.
  const contestables = contestablesOfRow(disputes, networkCode, level).filter(
    (decision) =>
      decision.kind === "revocation" || decision.requestId === shownRequestId,
  );
  const latest = latestDisputeOfRow(disputes, networkCode, level);
  if (disputes === null || (contestables.length === 0 && latest === null)) {
    return null;
  }
  return (
    <div className="flex flex-col gap-3" data-disputes={level}>
      {contestables.map((decision) => (
        <ContestableNotice
          key={
            decision.kind === "refusal" ? decision.requestId : decision.badgeId
          }
          decision={decision}
          network={network}
          windowDays={disputes.windowDays}
        />
      ))}
      {latest === null ? null : (
        <DisputeFollowUp dispute={latest} lines={lines} network={network} />
      )}
    </div>
  );
}
