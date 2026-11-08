"use client";

// Block ① of the decision screen of a creator's verification request, "La demande" (docs/mvp/08 RG47, RG55,
// RG60, RG63; 17b §3.7; jalons/l2e/modele.md §4; L2E-22): the account as the creator declared it, the
// badges it already holds, the earlier requests and their refusals, the alerts. Everything an agent needs
// to decide is on this screen (RG55). The handle is there to FIND the account, never a value to copy
// (RG47): no figure the creator declared, no code, no key. The profile link opens in a new window, with no
// referrer, and only when its address has the plain shape the database holds (L2DS-1, 0220).
import type { VerificationOpenResponse } from "@influx/contracts/verification";
import type { ReactNode } from "react";
import { messages } from "@/messages/fr";
import { HELP_CLASSES } from "./auth-classes";
import {
  BLOCK_TITLE,
  DD_CLASSES,
  DL_CLASSES,
  DT_CLASSES,
  LINK_CLASSES,
  SECTION_CLASSES,
  SECTION_TITLE,
  TABLE_CLASSES,
  TD_CLASSES,
  TH_CLASSES,
} from "./bo-classes";
import { DenseTableRegion } from "./DenseTableRegion";
import {
  alertLine,
  badgeLine,
  closedLines,
  levelName,
  profileLinkOf,
  reasonLabel,
  reexamineMarkLine,
} from "./verification-decision-view";
import { networkWords } from "./verification-queue-view";
import { countryName, formatDateTime } from "./view-model";

const t = messages.verificationReview;

/** How a closed request ended: written in clear, with the text the creator was sent and the internal comment. */
export function ClosedBlock({ view }: { view: VerificationOpenResponse }) {
  const decision = view.entry.decision;
  return (
    <section aria-labelledby="verification-closed" className={SECTION_CLASSES}>
      <h2 id="verification-closed" className={SECTION_TITLE}>
        {t.sections.decision}
      </h2>
      {closedLines(view).map((line) => (
        <p key={line} className="text-sm text-text-primary">
          {line}
        </p>
      ))}
      {decision?.memberMessage == null ? null : (
        <p className="text-sm text-text-primary">
          <span className="font-semibold">{t.closed.message}</span>{" "}
          <span className="whitespace-pre-wrap">{decision.memberMessage}</span>
        </p>
      )}
      {decision?.internalComment == null ? null : (
        <p className="text-sm text-text-secondary">
          <span className="font-semibold">{t.closed.comment}</span>{" "}
          <span className="whitespace-pre-wrap">
            {decision.internalComment}
          </span>
        </p>
      )}
    </section>
  );
}

export function RequestBlock({ view }: { view: VerificationOpenResponse }) {
  const { dossier, entry, account } = view;
  const creator = dossier?.creator ?? null;
  const language = (messages.languages as Readonly<Record<string, string>>)[
    account.preferredLanguage
  ];
  const profileLink = profileLinkOf(creator?.profileUrl ?? null);
  const reexamine = reexamineMarkLine(view);
  const facts: { key: string; label: string; value: ReactNode }[] = [
    {
      key: "creator",
      label: t.facts.creator,
      value: creator?.pseudonym ?? t.unset,
    },
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
    { key: "level", label: t.facts.level, value: levelName(entry.level) },
    ...(dossier === null
      ? []
      : [
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
        ]),
    {
      key: "submitted",
      label: t.facts.submitted,
      value: (
        <span className="tabular-nums">
          {formatDateTime(entry.submittedAt)}
        </span>
      ),
    },
    ...(dossier?.codeExpiresAt == null
      ? []
      : [
          {
            key: "codeExpiry",
            label: t.facts.codeExpiry,
            value: (
              <span className="tabular-nums">
                {formatDateTime(dossier.codeExpiresAt)}
              </span>
            ),
          },
        ]),
  ];
  return (
    <section aria-labelledby="verification-request" className={SECTION_CLASSES}>
      <h2 id="verification-request" className={SECTION_TITLE}>
        {t.sections.request}
      </h2>
      {reexamine === null ? null : (
        <p className="text-sm font-semibold text-text-primary">{reexamine}</p>
      )}
      <dl className={DL_CLASSES}>
        {facts.map((fact) => (
          <div key={fact.key} className="contents">
            <dt className={DT_CLASSES}>{fact.label}</dt>
            <dd className={DD_CLASSES}>{fact.value}</dd>
          </div>
        ))}
      </dl>
      {dossier === null ? null : (
        <DossierHistory dossier={dossier} view={view} />
      )}
    </section>
  );
}

function DossierHistory({
  dossier,
  view,
}: {
  dossier: NonNullable<VerificationOpenResponse["dossier"]>;
  view: VerificationOpenResponse;
}) {
  const network = networkWords(view.entry.networkCode);
  return (
    <>
      <div className="flex flex-col gap-1">
        <h3 className={BLOCK_TITLE}>{t.badges.title}</h3>
        {dossier.badges.length === 0 ? (
          <p className={HELP_CLASSES}>{t.badges.none}</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm text-text-primary">
            {dossier.badges.map((badge) => (
              <li key={badge.id} className="tabular-nums">
                {badgeLine(badge, network)}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <h3 className={BLOCK_TITLE}>{t.alerts.title}</h3>
        {dossier.alerts.length === 0 ? (
          <p className={HELP_CLASSES}>{t.alerts.none}</p>
        ) : (
          <>
            <p className={HELP_CLASSES}>{t.alerts.intro}</p>
            <ul className="list-disc pl-5 text-sm text-text-primary">
              {dossier.alerts.map((alert) => (
                <li key={alert.code}>{alertLine(alert)}</li>
              ))}
            </ul>
          </>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <h3 className={BLOCK_TITLE}>{t.history.title}</h3>
        {dossier.history.length === 0 ? (
          <p className={HELP_CLASSES}>{t.history.none}</p>
        ) : (
          <DenseTableRegion label={t.history.tableLabel}>
            <table className={TABLE_CLASSES}>
              <thead>
                <tr>
                  {(
                    [
                      t.history.columns.level,
                      t.history.columns.status,
                      t.history.columns.submitted,
                      t.history.columns.decided,
                      t.history.columns.reason,
                    ] as const
                  ).map((header) => (
                    <th key={header} scope="col" className={TH_CLASSES}>
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dossier.history.map((past) => (
                  <tr key={past.id}>
                    <td className={TD_CLASSES}>{levelName(past.level)}</td>
                    <td className={TD_CLASSES}>
                      {t.history.statuses[past.status]}
                    </td>
                    <td className={`${TD_CLASSES} tabular-nums`}>
                      {past.submittedAt === null
                        ? t.history.noReason
                        : formatDateTime(past.submittedAt)}
                    </td>
                    <td className={`${TD_CLASSES} tabular-nums`}>
                      {past.decidedAt === null
                        ? t.history.noReason
                        : formatDateTime(past.decidedAt)}
                    </td>
                    <td className={TD_CLASSES}>
                      {past.reasonCode === null
                        ? t.history.noReason
                        : reasonLabel(past.reasonCode)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DenseTableRegion>
        )}
      </div>
    </>
  );
}
