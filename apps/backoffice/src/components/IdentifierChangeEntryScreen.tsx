"use client";

// The decision screen of an identifier change, queue 6 (docs/mvp/08 RG78, CA54, RG98; 15 RG27 C1 to C8, RG29;
// 17b §2.7; jalons/l2f/modele.md §1 points 12 and 13, §5; L2F-19). Opening is claiming: the page calls POST
// …/open, and only the holder of the live claim is served the former and the new identifier (internal, never
// public, never in a list nor in a register). The badge stays: the agent states that it is the same account
// (typing the handle he reads), or requires a new proof (« à reconfirmer »). ‹v› and ‹r› open a panel and
// never decide. It only draws.
import type { IdentifierChangeOpenResponse } from "@influx/contracts/verification";
import type { ReactNode } from "react";
import { messages } from "@/messages/fr";
import { HELP_CLASSES } from "./auth-classes";
import {
  confirmIdentifierChangeEntry,
  extendIdentifierChangeClaim,
  forceReleaseIdentifierChangeClaim,
  openIdentifierChangeEntry,
  releaseIdentifierChangeEntry,
  requireIdentifierProofEntry,
} from "./backoffice-api";
import { stateWords } from "./account-badges-view";
import {
  DD_CLASSES,
  DL_CLASSES,
  DT_CLASSES,
  LINK_CLASSES,
  SECTION_CLASSES,
  SECTION_TITLE,
  SMALL_PRIMARY_CLASSES,
  SMALL_SECONDARY_CLASSES,
} from "./bo-classes";
import { CommentField, DecisionPanel } from "./ClaimedDecisionParts";
import { ClaimedEntryFrame } from "./ClaimedEntryFrame";
import {
  confirmCheck,
  confirmedNotice,
  proofCheck,
  proofNotice,
  type IdentifierPanel,
} from "./identifier-decision-view";
import {
  useClaimedEntry,
  type ClaimedApi,
  type ClaimedKeys,
} from "./use-claimed-entry";
import { profileLinkOf } from "./verification-decision-view";
import { networkWords } from "./verification-queue-view";
import { TypedField } from "./VerificationRecordBlock";
import { countryName, formatDate, formatDateTime } from "./view-model";

const t = messages.identifierReview;
const d = t.decision;
const LIST = "/files/identifiants-modifies";

const API: ClaimedApi<IdentifierChangeOpenResponse> = {
  open: openIdentifierChangeEntry,
  release: releaseIdentifierChangeEntry,
  extend: extendIdentifierChangeClaim,
  forceRelease: forceReleaseIdentifierChangeClaim,
};

/** ‹v› opens the statement « même compte » (the badge stays), ‹r› the demand of a new proof. */
const KEYS: ClaimedKeys<IdentifierPanel> = {
  positive: "confirm",
  negative: "proof",
};

const SHORTCUTS = {
  keys: t.shortcuts.keys,
  rows: [
    ["v", t.shortcuts.confirm],
    ["r", t.shortcuts.proof],
    ["l", messages.claimedReview.shortcuts.release],
    ["Échap", messages.claimedReview.shortcuts.escape],
    ["?", messages.claimedReview.shortcuts.help],
  ],
} as const;

function ChangeBlock({ view }: { view: IdentifierChangeOpenResponse }) {
  const { dossier, entry, account } = view;
  const language = (messages.languages as Readonly<Record<string, string>>)[
    account.preferredLanguage
  ];
  const profileLink = profileLinkOf(dossier?.creator.profileUrl ?? null);
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
    ...(dossier === null
      ? []
      : [
          {
            key: "previous",
            label: t.facts.previous,
            value: (
              <span className="font-mono break-all">
                {dossier.previousHandle ?? t.unknownPrevious}
              </span>
            ),
          },
          {
            key: "current",
            label: t.facts.current,
            value: (
              <span className="font-mono break-all">{dossier.newHandle}</span>
            ),
          },
          {
            key: "changes",
            label: t.facts.changes,
            value: String(dossier.changeCount),
          },
          {
            key: "lastChanged",
            label: t.facts.lastChanged,
            value: formatDateTime(dossier.lastChangedAt),
          },
          {
            key: "creator",
            label: t.facts.creator,
            value: dossier.creator.pseudonym ?? t.unset,
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
  ];
  return (
    <section aria-labelledby="identifier-change" className={SECTION_CLASSES}>
      <h2 id="identifier-change" className={SECTION_TITLE}>
        {t.sections.change}
      </h2>
      <dl className={DL_CLASSES}>
        {facts.map((fact) => (
          <div key={fact.key} className="contents">
            <dt className={DT_CLASSES}>{fact.label}</dt>
            <dd className={DD_CLASSES}>{fact.value}</dd>
          </div>
        ))}
      </dl>
      {dossier === null ? null : (
        <p className={HELP_CLASSES}>{t.internalOnly}</p>
      )}
    </section>
  );
}

function BadgesBlock({ view }: { view: IdentifierChangeOpenResponse }) {
  const dossier = view.dossier;
  if (dossier === null) {
    return null;
  }
  const { accountBadge, audienceBadge } = dossier;
  return (
    <section aria-labelledby="identifier-badges" className={SECTION_CLASSES}>
      <h2 id="identifier-badges" className={SECTION_TITLE}>
        {t.sections.badges}
      </h2>
      {accountBadge === null && audienceBadge === null ? (
        <p className="text-sm text-text-primary">{t.badges.none}</p>
      ) : null}
      {accountBadge === null ? null : (
        <p className="text-sm text-text-primary">
          {t.badges.account(
            stateWords(accountBadge.state),
            formatDate(accountBadge.grantedAt),
          )}
        </p>
      )}
      {audienceBadge === null ? null : (
        <p className="text-sm text-text-primary">
          {t.badges.audience(
            stateWords(audienceBadge.state),
            audienceBadge.expiresAt === null
              ? t.badges.noExpiry
              : t.badges.expires(formatDate(audienceBadge.expiresAt)),
          )}
        </p>
      )}
    </section>
  );
}

function ClosedBlock({ view }: { view: IdentifierChangeOpenResponse }) {
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
        : c[decision.state],
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
    if (decision.late) {
      lines.push(messages.claimedReview.late);
    }
  }
  return (
    <section aria-labelledby="identifier-closed" className={SECTION_CLASSES}>
      <h2 id="identifier-closed" className={SECTION_TITLE}>
        {t.sections.outcome}
      </h2>
      {lines.map((line) => (
        <p key={line} className="text-sm text-text-primary">
          {line}
        </p>
      ))}
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

export function IdentifierChangeEntryScreen({ id }: { id: string }) {
  const entry = useClaimedEntry<IdentifierChangeOpenResponse, IdentifierPanel>(
    id,
    LIST,
    API,
    KEYS,
    "identifier",
  );
  const { perform, finish, draft, setProblem, setDraft, panel, problem, busy } =
    entry;

  function confirm(view: IdentifierChangeOpenResponse) {
    if (view.reviewToken === null) {
      return;
    }
    const checked = confirmCheck(draft, view.reviewToken);
    if (!checked.ok) {
      setProblem(checked.problem);
      return;
    }
    void perform(
      "confirm",
      view,
      () => confirmIdentifierChangeEntry(view.entry.id, checked.body),
      (data) => finish(view, data.next, confirmedNotice(view, data.late)),
    );
  }

  function requireProof(view: IdentifierChangeOpenResponse) {
    if (view.reviewToken === null) {
      return;
    }
    const checked = proofCheck(draft, view.reviewToken);
    if (!checked.ok) {
      setProblem(checked.problem);
      return;
    }
    void perform(
      "proof",
      view,
      () => requireIdentifierProofEntry(view.entry.id, checked.body),
      (data) => finish(view, data.next, proofNotice(view, data.late)),
    );
  }

  const busyNow = busy !== null;
  const open = (next: IdentifierPanel) => {
    setProblem(null);
    entry.setPanel(next);
  };

  return (
    <ClaimedEntryFrame
      entry={entry}
      list={LIST}
      heading={messages.queue.identity_change_review}
      titleOf={(view) => t.title(networkWords(view.entry.networkCode))}
      subtitleOf={(view) => t.subtitle(formatDateTime(view.entry.createdAt))}
      shortcuts={SHORTCUTS}
    >
      {(view, mode) => (
        <>
          {mode === "closed" ? <ClosedBlock view={view} /> : null}
          <ChangeBlock view={view} />
          <BadgesBlock view={view} />
          {mode === "deciding" ? (
            <section
              aria-labelledby="identifier-outcome"
              className={SECTION_CLASSES}
            >
              <h2 id="identifier-outcome" className={SECTION_TITLE}>
                {t.sections.outcome}
              </h2>
              <p className={HELP_CLASSES}>{d.lead}</p>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  aria-keyshortcuts="v"
                  aria-expanded={panel === "confirm"}
                  aria-disabled={busyNow || undefined}
                  onClick={() => {
                    if (!busyNow) {
                      open("confirm");
                    }
                  }}
                  className={
                    panel === "confirm"
                      ? SMALL_SECONDARY_CLASSES
                      : SMALL_PRIMARY_CLASSES
                  }
                >
                  {d.confirm}
                </button>
                <button
                  type="button"
                  aria-keyshortcuts="r"
                  aria-expanded={panel === "proof"}
                  aria-disabled={busyNow || undefined}
                  onClick={() => {
                    if (!busyNow) {
                      open("proof");
                    }
                  }}
                  className={SMALL_SECONDARY_CLASSES}
                >
                  {d.requireProof}
                </button>
              </div>
              {panel === "confirm" ? (
                <DecisionPanel
                  id="identifier-confirm"
                  title={d.confirmTitle}
                  lead={d.confirmLead}
                  problem={problem}
                  busy={busy === "confirm"}
                  busyNow={busyNow}
                  confirmLabel={d.confirmConfirm}
                  onConfirm={() => confirm(view)}
                  onCancel={() => entry.setPanel(null)}
                >
                  <TypedField
                    field="handle"
                    label={d.handle}
                    value={draft.handle}
                    problem={problem}
                    mono
                    onChange={(handle) => setDraft({ ...draft, handle })}
                  />
                  <CommentField
                    draft={draft}
                    problem={problem}
                    onDraft={setDraft}
                  />
                </DecisionPanel>
              ) : null}
              {panel === "proof" ? (
                <DecisionPanel
                  id="identifier-proof"
                  title={d.proofTitle}
                  lead={d.proofLead}
                  problem={problem}
                  busy={busy === "proof"}
                  busyNow={busyNow}
                  confirmLabel={d.proofConfirm}
                  onConfirm={() => requireProof(view)}
                  onCancel={() => entry.setPanel(null)}
                >
                  <CommentField
                    draft={draft}
                    problem={problem}
                    onDraft={setDraft}
                  />
                </DecisionPanel>
              ) : null}
            </section>
          ) : null}
        </>
      )}
    </ClaimedEntryFrame>
  );
}
