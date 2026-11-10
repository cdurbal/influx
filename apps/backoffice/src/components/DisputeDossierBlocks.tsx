"use client";

// The read-only blocks of the decision screen of a contest (docs/mvp/08 RG77; 15 RG27 C8; 17b §2.7;
// jalons/l2f/modele.md §3 « 0232 »; L2F-19): the contest as the creator wrote it, the decision contested
// (a refusal with its reason and the message sent, or a withdrawal with its dates), who decided it, how the
// contest is judged, and how a closed one ended. The handle is there to FIND the account, never a value to
// copy (RG47); no figure, no code and no key are served. The profile link opens in a new window, with no
// referrer, and only when its address has the plain shape the database holds.
import type { DisputeOpenResponse } from "@influx/contracts/verification";
import type { ReactNode } from "react";
import { messages } from "@/messages/fr";
import { HELP_CLASSES } from "./auth-classes";
import { reasonWords } from "./account-badges-view";
import {
  DD_CLASSES,
  DL_CLASSES,
  DT_CLASSES,
  LINK_CLASSES,
  SECTION_CLASSES,
  SECTION_TITLE,
} from "./bo-classes";
import { reflectionLine } from "./dispute-decision-view";
import { disputeReasonWords } from "./claimed-queue-view";
import { profileLinkOf, reasonLabel } from "./verification-decision-view";
import { levelWords, networkWords } from "./verification-queue-view";
import { countryName, formatDateTime } from "./view-model";

const t = messages.disputeReview;

/** « La contestation » and « La décision contestée »: what the contest says and what it contests. */
export function ContestBlock({ view }: { view: DisputeOpenResponse }) {
  const { dossier, entry, account } = view;
  const language = (messages.languages as Readonly<Record<string, string>>)[
    account.preferredLanguage
  ];
  const creator = dossier?.creator ?? null;
  const profileLink = profileLinkOf(creator?.profileUrl ?? null);
  const mode = reflectionLine(view, view.asOf);
  const facts: { key: string; label: string; value: ReactNode }[] = [
    {
      key: "country",
      label: t.facts.country,
      value: countryName(account.countryCode),
    },
    {
      key: "language",
      label: t.facts.language,
      value: language ?? account.preferredLanguage,
    },
    {
      key: "owner",
      label: t.facts.owner,
      value: account.owner?.displayName ?? t.noOwner,
    },
    {
      key: "network",
      label: t.facts.network,
      value: networkWords(entry.networkCode),
    },
    { key: "level", label: t.facts.level, value: levelWords(entry.level) },
    {
      key: "kind",
      label: t.facts.kind,
      value: messages.disputeQueue.kinds[entry.kind],
    },
    {
      key: "submitted",
      label: t.facts.submitted,
      value: formatDateTime(entry.submittedAt),
    },
    ...(dossier === null
      ? []
      : [
          {
            key: "reason",
            label: t.facts.reason,
            value: disputeReasonWords(dossier.reasonCode),
          },
          {
            key: "text",
            label: t.facts.text,
            value:
              dossier.text === null ? (
                t.noText
              ) : (
                <span className="whitespace-pre-wrap">{dossier.text}</span>
              ),
          },
          {
            key: "creator",
            label: t.facts.creator,
            value: creator?.pseudonym ?? t.unset,
          },
          {
            key: "handle",
            label: t.facts.handle,
            value: (
              <>
                <span className="font-mono break-all">
                  {creator?.handle ?? t.unset}
                </span>
                <span className="block text-text-secondary">
                  {t.handleHelp}
                </span>
              </>
            ),
          },
          {
            key: "profile",
            label: t.facts.profile,
            value:
              profileLink === null ? (
                t.profileNoLink
              ) : (
                <a
                  href={profileLink}
                  target="_blank"
                  rel="noreferrer noopener"
                  className={LINK_CLASSES}
                >
                  {t.profileLink}
                </a>
              ),
          },
          {
            key: "deciders",
            label: t.facts.deciders,
            value:
              dossier.deciders
                .map((person) => person.displayName ?? t.unset)
                .join(", ") || t.unset,
          },
        ]),
  ];
  return (
    <section aria-labelledby="dispute-contest" className={SECTION_CLASSES}>
      <h2 id="dispute-contest" className={SECTION_TITLE}>
        {t.sections.contest}
      </h2>
      <dl className={DL_CLASSES}>
        {facts.map((fact) => (
          <div key={fact.key} className="contents">
            <dt className={DT_CLASSES}>{fact.label}</dt>
            <dd className={DD_CLASSES}>{fact.value}</dd>
          </div>
        ))}
      </dl>
      {mode === null ? null : <p className={HELP_CLASSES}>{mode}</p>}
    </section>
  );
}

/** The decision contested: the refusal and the message the creator received, or the withdrawal and its dates. */
export function ContestedDecisionBlock({
  view,
}: {
  view: DisputeOpenResponse;
}) {
  const dossier = view.dossier;
  if (dossier === null) {
    return null;
  }
  const { refusal, revocation } = dossier;
  const r = t.refusal;
  const w = t.revocation;
  return (
    <section aria-labelledby="dispute-decision" className={SECTION_CLASSES}>
      <h2 id="dispute-decision" className={SECTION_TITLE}>
        {t.sections.decision}
      </h2>
      {refusal === null ? null : (
        <>
          <p className="text-sm text-text-primary">
            {r.line(
              reasonLabel(refusal.reasonCode).toLowerCase(),
              formatDateTime(refusal.decidedAt),
            )}
          </p>
          {refusal.memberMessage === null ? null : (
            <p className="text-sm whitespace-pre-wrap text-text-primary">
              {r.message(refusal.memberMessage)}
            </p>
          )}
          {refusal.codeExpiresAt === null ? null : (
            <p className={HELP_CLASSES}>
              {r.codeExpires(formatDateTime(refusal.codeExpiresAt))}
            </p>
          )}
        </>
      )}
      {revocation === null ? null : (
        <>
          <p className="text-sm text-text-primary">
            {w.line(
              reasonWords(revocation.reasonCode).toLowerCase(),
              formatDateTime(revocation.revokedAt),
            )}
          </p>
          <p className="text-sm text-text-primary">
            {w.granted(formatDateTime(revocation.grantedAt))}{" "}
            {revocation.expiresAt === null
              ? w.noExpiry
              : w.expires(formatDateTime(revocation.expiresAt))}
          </p>
          {revocation.memberMessage === null ? null : (
            <p className="text-sm whitespace-pre-wrap text-text-primary">
              {w.message(revocation.memberMessage)}
            </p>
          )}
          {revocation.cascadeBadgeIds.length === 0 ? null : (
            <p className={HELP_CLASSES}>
              {w.cascade(revocation.cascadeBadgeIds.length)}
            </p>
          )}
        </>
      )}
    </section>
  );
}

/** How a contest that left the queue ended (15 C8): written in clear, with the internal comment for agents. */
export function ClosedDisputeBlock({ view }: { view: DisputeOpenResponse }) {
  const { decision } = view.entry;
  const c = t.closed;
  const lines: string[] = [];
  if (decision !== null) {
    lines.push(
      decision.state === "withdrawn"
        ? c.withdrawn(
            decision.withdrawnCause === null
              ? ""
              : (c.causes[decision.withdrawnCause] ?? decision.withdrawnCause),
          )
        : decision.state === "upheld"
          ? c.upheld
          : c.overturned,
    );
    lines.push(
      decision.decidedBy === null
        ? c.decidedAt(formatDateTime(decision.decidedAt))
        : c.decidedBy(
            decision.decidedBy.displayName ??
              messages.queueReview.banner.forcedReleaseUnknown,
            formatDateTime(decision.decidedAt),
          ),
    );
    if (decision.reviewMode !== null) {
      lines.push(c.modes[decision.reviewMode]);
    }
    if (decision.late) {
      lines.push(messages.claimedReview.late);
    }
    if (decision.outcomeReasonCode !== null) {
      lines.push(
        c.reason(
          t.decision.outcomeLabels[decision.outcomeReasonCode] ??
            decision.outcomeReasonCode,
        ),
      );
    }
  }
  return (
    <section aria-labelledby="dispute-closed" className={SECTION_CLASSES}>
      <h2 id="dispute-closed" className={SECTION_TITLE}>
        {t.sections.outcome}
      </h2>
      {lines.map((line) => (
        <p key={line} className="text-sm text-text-primary">
          {line}
        </p>
      ))}
      {decision?.memberMessage == null ? null : (
        <p className="text-sm text-text-primary">
          <span className="font-semibold">{c.message}</span>{" "}
          <span className="whitespace-pre-wrap">{decision.memberMessage}</span>
        </p>
      )}
      {decision?.internalComment == null ? null : (
        <p className="text-sm text-text-secondary">
          <span className="font-semibold">{c.comment}</span>{" "}
          <span className="whitespace-pre-wrap">
            {decision.internalComment}
          </span>
        </p>
      )}
    </section>
  );
}
