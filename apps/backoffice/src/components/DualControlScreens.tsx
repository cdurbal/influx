"use client";

// The dual control and its degraded form (docs/mvp/03 §1.3 PD1 to PD7; 15 RG9, RG31, RG107; 17b
// §2.7 queue 15, §3.13.c). The confirmation is a DISTINCT screen, reached by its own gesture (PD2).
// What THIS admin may do comes from apps/api (`next`, PD7: no flag, no setting): confirm as a peer;
// confirm alone after the 60 seconds written and counted, with a written justification, under the
// banner that says the control is weakened (RG9); wait for a peer; or nothing. R is asked by
// apps/api at the confirmation (PD3); the countdown is the only artificial delay of the backoffice.
import {
  DEGRADED_JUSTIFICATION_MAX,
  DEGRADED_JUSTIFICATION_MIN,
  type DualControlViewBody,
} from "@influx/contracts/backoffice-actions";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState, type ReactNode } from "react";
import { messages } from "@/messages/fr";
import {
  ERROR_CLASSES,
  HELP_CLASSES,
  LEAD_CLASSES,
  TITLE_CLASSES,
  WARNING_CLASSES,
} from "./auth-classes";
import { ActionFeedback } from "./ActionFeedback";
import {
  cancelDualControl,
  confirmDualControl,
  readDualControl,
  readDualControls,
  readInternalAccounts,
} from "./backoffice-api";
import {
  DD_CLASSES,
  DL_CLASSES,
  DT_CLASSES,
  FIELD_CLASSES,
  LINK_CLASSES,
  SECTION_CLASSES,
  SECTION_TITLE_CLASSES,
  SMALL_LABEL_CLASSES,
  SMALL_PRIMARY_CLASSES,
  SMALL_SECONDARY_CLASSES,
  SUCCESS_CLASSES,
  TABLE_CLASSES,
  TABLE_WRAP_CLASSES,
  TD_CLASSES,
  TEXTAREA_CLASSES,
  TH_CLASSES,
} from "./bo-classes";
import { useAction } from "./use-action";
import { apolloSettingWords, formatDateTime, personName } from "./view-model";

const t = messages.dualControl;

/** First names of the team, to name a requester (admin screens only). */
function useTeamNames(): ReadonlyMap<string, string | null> {
  const [names, setNames] = useState<ReadonlyMap<string, string | null>>(
    new Map(),
  );
  useEffect(() => {
    let active = true;
    void readInternalAccounts().then((result) => {
      if (active && result.kind === "ok") {
        setNames(
          new Map(
            result.data.accounts.map((account) => [
              account.id,
              account.firstName,
            ]),
          ),
        );
      }
    });
    return () => {
      active = false;
    };
  }, []);
  return names;
}

/** The object of the action, in words (PD1: the exact scope). */
function ActionTarget({ view }: { view: DualControlViewBody }) {
  const { action } = view;
  switch (action.code) {
    case "identity.grant_role":
      return (
        <>
          <Field label={t.target.account}>
            <Link
              href={`/inscrits/${action.accountId}`}
              className={LINK_CLASSES}
            >
              {t.openAccount}
            </Link>
          </Field>
          <Field label={t.target.role}>{messages.roles[action.role]}</Field>
        </>
      );
    case "identity.change_member_role":
      return (
        <>
          <Field label={t.target.account}>
            <Link
              href={`/inscrits/${action.accountId}`}
              className={LINK_CLASSES}
            >
              {t.openAccount}
            </Link>
          </Field>
          <Field label={t.target.legalName}>{action.legalName}</Field>
        </>
      );
    case "identity.invite_admin":
      return (
        <Field label={t.target.invitation}>
          <span className="font-mono">{action.invitationId}</span>
        </Field>
      );
    case "privacy.approve_data_request":
      return (
        <Field label={t.target.request}>
          {messages.account.dataRequestType[action.requestType]}
        </Field>
      );
    case "leads.change_apollo_setting":
      return (
        <Field label={t.target.setting}>
          {apolloSettingWords(action.setting)}
        </Field>
      );
  }
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className={DT_CLASSES}>{label}</dt>
      <dd className={DD_CLASSES}>{children}</dd>
    </div>
  );
}

export function DualControlListScreen() {
  const router = useRouter();
  const names = useTeamNames();
  const [requests, setRequests] = useState<DualControlViewBody[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void readDualControls().then((result) => {
      if (!active) {
        return;
      }
      if (result.kind === "ok") {
        setRequests(result.data.requests);
      } else if (result.kind === "unauthenticated") {
        router.replace("/");
      } else {
        setError(
          result.code === "forbidden" ? messages.failure.forbidden : t.error,
        );
      }
    });
    return () => {
      active = false;
    };
  }, [router]);

  return (
    <>
      <h1 className={TITLE_CLASSES}>{t.title}</h1>
      <p className={LEAD_CLASSES}>{t.lead}</p>
      {error !== null ? (
        <p role="alert" className={ERROR_CLASSES}>
          {error}
        </p>
      ) : requests === null ? (
        <p role="status" className={HELP_CLASSES}>
          {messages.common.loading}
        </p>
      ) : requests.length === 0 ? (
        <p className={HELP_CLASSES}>{t.empty}</p>
      ) : (
        <div className={TABLE_WRAP_CLASSES}>
          <table className={TABLE_CLASSES}>
            <caption className="sr-only">{t.title}</caption>
            <thead>
              <tr>
                {(["action", "requestedBy", "expires", "next"] as const).map(
                  (column) => (
                    <th key={column} scope="col" className={TH_CLASSES}>
                      {t.columns[column]}
                    </th>
                  ),
                )}
                <th scope="col" className={TH_CLASSES}>
                  {t.open}
                </th>
              </tr>
            </thead>
            <tbody>
              {requests.map((request) => (
                <tr key={request.id}>
                  <td className={TD_CLASSES}>
                    {t.actions[request.action.code] ?? request.action.code}
                  </td>
                  <td className={TD_CLASSES}>
                    {personName(names, request.requestedBy)}
                  </td>
                  <td className={`${TD_CLASSES} tabular-nums`}>
                    {formatDateTime(request.expiresAt)}
                  </td>
                  <td className={TD_CLASSES}>{t.next[request.next.kind]}</td>
                  <td className={TD_CLASSES}>
                    <Link
                      href={`/double-validation/${request.id}`}
                      className={LINK_CLASSES}
                    >
                      {t.open}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

/**
 * PD2: the seconds left, counted down from apps/api's own count (the database clock) and the
 * instant that count was received; the database refuses an early confirmation anyway.
 */
function useCountdown(
  initial: number | null,
  receivedAt: number | null,
): number | null {
  const [now, setNow] = useState(() => Date.now());
  const running = initial !== null && initial > 0;
  useEffect(() => {
    if (!running) {
      return undefined;
    }
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, [running]);
  if (initial === null || receivedAt === null) {
    return null;
  }
  // `now` may predate the answer (set at mount, and never ticking once the count is 0): the time
  // elapsed is never negative, or a count of 0 would read 1 and hold the button for ever.
  const elapsed = Math.max(0, now - receivedAt);
  return Math.max(0, initial - Math.floor(elapsed / 1_000));
}

export function DualControlScreen({ id }: { id: string }) {
  const router = useRouter();
  const names = useTeamNames();
  const ids = { justification: useId(), justificationError: useId() };
  const action = useAction();
  const [loaded, setLoaded] = useState<{
    view: DualControlViewBody;
    at: number;
  } | null>(null);
  const view = loaded?.view ?? null;
  const [loadError, setLoadError] = useState<string | null>(null);
  const [justification, setJustification] = useState("");
  const [justificationError, setJustificationError] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const left = useCountdown(
    view?.next.kind === "confirm_degraded" ? view.next.secondsLeft : null,
    loaded?.at ?? null,
  );

  useEffect(() => {
    let active = true;
    void readDualControl(id).then((result) => {
      if (!active) {
        return;
      }
      if (result.kind === "ok") {
        setLoaded({ view: result.data, at: Date.now() });
      } else if (result.kind === "unauthenticated") {
        router.replace("/");
      } else {
        setLoadError(
          result.code === "not_found"
            ? messages.failure.notFound
            : result.code === "forbidden"
              ? messages.failure.forbidden
              : t.error,
        );
      }
    });
    return () => {
      active = false;
    };
  }, [id, router]);

  if (loadError !== null) {
    return (
      <>
        <h1 className={TITLE_CLASSES}>{t.requestTitle}</h1>
        <p role="alert" className={ERROR_CLASSES}>
          {loadError}
        </p>
      </>
    );
  }
  if (view === null) {
    return (
      <>
        <h1 className={TITLE_CLASSES}>{t.requestTitle}</h1>
        <p role="status" className={HELP_CLASSES}>
          {messages.common.loading}
        </p>
      </>
    );
  }

  const current = view;
  const degraded = view.next.kind === "confirm_degraded";
  const canConfirm =
    view.next.kind === "confirm_as_peer" || (degraded && (left ?? 0) <= 0);

  function confirm() {
    if (!canConfirm || action.busy) {
      return;
    }
    const text = justification.trim();
    if (degraded && text.length < DEGRADED_JUSTIFICATION_MIN) {
      setJustificationError(true);
      return;
    }
    setJustificationError(false);
    void action.run(
      () => confirmDualControl(current.id, degraded ? text : null),
      (data) =>
        setDone(
          [
            t.done(data.mode === "degraded_single_operator"),
            data.reevaluated === null ? "" : t.reevaluated(data.reevaluated),
          ]
            .filter(Boolean)
            .join(" "),
        ),
    );
  }

  function cancel() {
    if (action.busy) {
      return;
    }
    void action.run(
      () => cancelDualControl(current.id),
      () => setDone(t.cancelled),
    );
  }

  return (
    <>
      <Link href="/double-validation" className={LINK_CLASSES}>
        {t.title}
      </Link>
      <h1 className={TITLE_CLASSES}>{t.requestTitle}</h1>
      <p>
        {t.requestedBy(
          personName(names, view.requestedBy),
          formatDateTime(view.requestedAt),
          formatDateTime(view.expiresAt),
        )}
      </p>
      <section aria-labelledby="action-title" className={SECTION_CLASSES}>
        <h2 id="action-title" className={SECTION_TITLE_CLASSES}>
          {t.actions[view.action.code] ?? view.action.code}
        </h2>
        <dl className={DL_CLASSES}>
          <ActionTarget view={view} />
          <Field label={t.reason}>
            {t.reasons[view.reasonCode] ?? view.reasonCode}
          </Field>
          {view.reasonNote === null ? null : (
            <Field label={t.note}>{view.reasonNote}</Field>
          )}
        </dl>
        <p className="font-semibold">{t.consequencesTitle}</p>
        <ul className="list-disc pl-6 text-sm">
          {view.recap.consequences.map((code) => (
            <li key={code}>{t.consequences[code] ?? code}</li>
          ))}
        </ul>
        <p className="text-sm">{t.scope(view.recap.scope.count)}</p>
        <p className="text-sm font-semibold">
          {t.reversible(view.recap.reversible)}
        </p>
        <p className="text-sm">
          {view.confirmation === null
            ? t.states[view.state]
            : t.confirmedBy(
                personName(names, view.confirmation.by),
                formatDateTime(view.confirmation.at),
              )}
        </p>
      </section>

      {done !== null ? (
        <p role="status" className={SUCCESS_CLASSES}>
          {done}
        </p>
      ) : view.next.kind === "await_peer" ? (
        <>
          <p className={HELP_CLASSES}>{t.awaitPeer}</p>
          <ActionFeedback action={action} />
          <button
            type="button"
            onClick={cancel}
            className={`${SMALL_SECONDARY_CLASSES} self-start`}
          >
            {t.refuse}
          </button>
        </>
      ) : view.next.kind === "none" ? (
        <p className={HELP_CLASSES}>{t.noAction}</p>
      ) : (
        <section aria-labelledby="confirm-title" className={SECTION_CLASSES}>
          <h2 id="confirm-title" className={SECTION_TITLE_CLASSES}>
            {t.confirm}
          </h2>
          {degraded ? (
            <>
              <p role="status" className={WARNING_CLASSES}>
                {t.degraded}
              </p>
              <p aria-live="polite" className="font-semibold tabular-nums">
                {t.countdown(left ?? 0)}
              </p>
              <div className={FIELD_CLASSES}>
                <label
                  htmlFor={ids.justification}
                  className={SMALL_LABEL_CLASSES}
                >
                  {t.justification(
                    DEGRADED_JUSTIFICATION_MIN,
                    DEGRADED_JUSTIFICATION_MAX,
                  )}
                </label>
                <textarea
                  id={ids.justification}
                  maxLength={DEGRADED_JUSTIFICATION_MAX}
                  value={justification}
                  aria-invalid={justificationError || undefined}
                  aria-describedby={
                    justificationError ? ids.justificationError : undefined
                  }
                  onChange={(event) => setJustification(event.target.value)}
                  className={TEXTAREA_CLASSES}
                />
              </div>
              {justificationError ? (
                <p
                  id={ids.justificationError}
                  role="alert"
                  className={ERROR_CLASSES}
                >
                  {t.justificationInvalid(DEGRADED_JUSTIFICATION_MIN)}
                </p>
              ) : null}
            </>
          ) : null}
          <ActionFeedback action={action} />
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={cancel}
              className={SMALL_SECONDARY_CLASSES}
            >
              {t.refuse}
            </button>
            <button
              type="button"
              onClick={confirm}
              aria-disabled={!canConfirm || action.busy || undefined}
              className={SMALL_PRIMARY_CLASSES}
            >
              {action.busy ? messages.common.busy : t.confirm}
            </button>
          </div>
        </section>
      )}
    </>
  );
}
