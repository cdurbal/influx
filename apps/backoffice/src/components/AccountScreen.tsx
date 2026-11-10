"use client";

// The record of a member account (docs/mvp/05 RG97 to RG100, RG107, RG108, RG93; 15 RG40 to RG44,
// §G; 17b §3.11, §3.12 minimal, §3.13.c). Its opening is journaled by apps/api (EC-J8-24) and the
// screen says so. Never a sign-in code, a password, an e-mail content nor an Apollo datum (RG107).
// The admin's actions (role change, "mes données" execution) are REQUESTED here and confirmed on the
// distinct screen of the dual control (03 PD2); the lift of a Brevo suppression asks for R.
import {
  SYNC_DESTINATIONS,
  type AccountDetailResponse,
  type HistoryEvent,
  type SyncDestination,
} from "@influx/contracts/backoffice-accounts";
import {
  CORRECTION_REASONS,
  ROLE_CHANGE_REASONS,
  SUPPRESSION_LIFT_REASONS,
} from "@influx/contracts/backoffice-actions";
import { UI_LOCALES } from "@influx/contracts/auth";
import { DECLARED_STATUSES } from "@influx/contracts/signup";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useId,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { messages } from "@/messages/fr";
import { HELP_CLASSES, inputClasses, TITLE_CLASSES } from "./auth-classes";
import { AccountBadgesBlock } from "./AccountBadgesBlock";
import { AccountOpeningBlock } from "./AccountOpeningBlock";
import { AccountBrandBlocks } from "./AccountBrandBlocks";
import { ActionFeedback, AdminOnlyNotice } from "./ActionFeedback";
import {
  correctionNotice,
  correctionOutcome,
  LEGAL_NAME_MAX,
  NOTE_MAX,
  roleChangeOutcome,
  suppressionCanSubmit,
  suppressionOutcome,
  suppressionRefusal,
} from "./account-record-forms";
import {
  correctAccount,
  liftSuppression,
  readAccount,
  requestDualControl,
} from "./backoffice-api";
import {
  DD_CLASSES,
  DL_CLASSES,
  DT_CLASSES,
  FIELD_CLASSES,
  LINK_CLASSES,
  ROW_GROUP_CLASSES,
  SECTION_CLASSES,
  SECTION_TITLE,
  SELECT_CLASSES,
  SMALL_LABEL_CLASSES,
  SMALL_PRIMARY_CLASSES,
  SMALL_SECONDARY_CLASSES,
  SUCCESS_CLASSES,
  TEXTAREA_CLASSES,
} from "./bo-classes";
import { ReplayPanel } from "./ReplayPanel";
import { useMe } from "./Shell";
import { useAction } from "./use-action";
import {
  countryName,
  countryOptions,
  formatDate,
  formatDateTime,
  formatLongDate,
} from "./view-model";
import { ErrorNotice } from "./ErrorNotice";

type Detail = AccountDetailResponse;
type Load =
  | { kind: "loading" }
  | { kind: "ok"; data: Detail }
  | { kind: "error"; message: string };

const t = messages.account;

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className={DT_CLASSES}>{label}</dt>
      <dd className={DD_CLASSES}>{children}</dd>
    </div>
  );
}

function SyncBlock({
  detail,
  onReplayed,
}: {
  detail: Detail;
  onReplayed: () => void;
}) {
  const [replaying, setReplaying] = useState<SyncDestination | null>(null);
  return (
    <section aria-labelledby="sync-title" className={SECTION_CLASSES}>
      <h2 id="sync-title" className={SECTION_TITLE}>
        {t.sync}
      </h2>
      <dl className={DL_CLASSES}>
        {SYNC_DESTINATIONS.map((destination) => {
          const status = detail.account.sync[destination];
          return (
            <Field key={destination} label={messages.destinations[destination]}>
              <span className="block font-semibold">
                {messages.syncState[status.state]}
              </span>
              <span className="block">
                {status.setting === null
                  ? messages.syncCause[status.cause]
                  : messages.syncCauseWithSetting(
                      messages.syncCause[status.cause],
                      messages.syncSetting[status.setting],
                    )}
              </span>
              {status.lastAttemptAt === null ? null : (
                <span className="block text-text-secondary">
                  {t.lastAttempt(formatDateTime(status.lastAttemptAt))}
                </span>
              )}
              {status.retryAt === null ? null : (
                <span className="block text-text-secondary">
                  {t.retryAt(formatDateTime(status.retryAt))}
                </span>
              )}
              {status.state === "failed" ? (
                <button
                  type="button"
                  onClick={() => setReplaying(destination)}
                  className={`${SMALL_SECONDARY_CLASSES} mt-2`}
                >
                  {messages.replay.unit(messages.destinations[destination])}
                </button>
              ) : status.state === "skipped" ? (
                <span className="block text-text-secondary">{t.noReplay}</span>
              ) : null}
            </Field>
          );
        })}
      </dl>
      {replaying === null ? null : (
        <ReplayPanel
          pairs={[{ accountId: detail.account.id, destination: replaying }]}
          onCancel={() => setReplaying(null)}
          onDone={() => {
            setReplaying(null);
            onReplayed();
          }}
        />
      )}
    </section>
  );
}

function CorrectionForm({
  detail,
  onCorrected,
}: {
  detail: Detail;
  onCorrected: () => void;
}) {
  const ids = {
    status: useId(),
    country: useId(),
    language: useId(),
    reason: useId(),
    note: useId(),
  };
  const action = useAction();
  const countries = useMemo(() => countryOptions(), []);
  const [declaredStatus, setDeclaredStatus] = useState("");
  const [country, setCountry] = useState("");
  const [language, setLanguage] = useState("");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    const outcome = correctionOutcome({
      declaredStatus,
      country,
      language,
      reason,
      note,
    });
    if (!outcome.ok) {
      setFormError(outcome.error);
      return;
    }
    setFormError(null);
    void action.run(
      () => correctAccount(detail.account.id, outcome.body),
      (data) => {
        setNotice(correctionNotice(data.changed));
        if (data.changed) {
          onCorrected();
        }
      },
    );
  }

  return (
    <form
      noValidate
      onSubmit={submit}
      aria-labelledby="correct-title"
      className={SECTION_CLASSES}
    >
      <h2 id="correct-title" className={SECTION_TITLE}>
        {t.corrections}
      </h2>
      <p className={HELP_CLASSES}>{t.correctionsLead}</p>
      <div className={ROW_GROUP_CLASSES}>
        <div className={FIELD_CLASSES}>
          <label htmlFor={ids.status} className={SMALL_LABEL_CLASSES}>
            {t.declaredStatus}
          </label>
          <select
            id={ids.status}
            value={declaredStatus}
            onChange={(event) => setDeclaredStatus(event.target.value)}
            className={SELECT_CLASSES}
          >
            <option value="">{t.unchanged}</option>
            {DECLARED_STATUSES.map((value) => (
              <option key={value} value={value}>
                {messages.declaredStatus[value]}
              </option>
            ))}
          </select>
        </div>
        <div className={FIELD_CLASSES}>
          <label htmlFor={ids.country} className={SMALL_LABEL_CLASSES}>
            {t.country}
          </label>
          <select
            id={ids.country}
            value={country}
            onChange={(event) => setCountry(event.target.value)}
            className={SELECT_CLASSES}
          >
            <option value="">{t.unchanged}</option>
            {countries.map((option) => (
              <option key={option.code} value={option.code}>
                {option.name}
              </option>
            ))}
          </select>
        </div>
        <div className={FIELD_CLASSES}>
          <label htmlFor={ids.language} className={SMALL_LABEL_CLASSES}>
            {t.language}
          </label>
          <select
            id={ids.language}
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
            className={SELECT_CLASSES}
          >
            <option value="">{t.unchanged}</option>
            {UI_LOCALES.map((value) => (
              <option key={value} value={value}>
                {messages.languages[value]}
              </option>
            ))}
          </select>
        </div>
        <div className={FIELD_CLASSES}>
          <label htmlFor={ids.reason} className={SMALL_LABEL_CLASSES}>
            {messages.common.reason}
          </label>
          <select
            id={ids.reason}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className={SELECT_CLASSES}
          >
            <option value="">{messages.common.reasonPlaceholder}</option>
            {CORRECTION_REASONS.map((code) => (
              <option key={code} value={code}>
                {t.correctionsReasons[code]}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className={FIELD_CLASSES}>
        <label htmlFor={ids.note} className={SMALL_LABEL_CLASSES}>
          {messages.common.note}
        </label>
        <textarea
          id={ids.note}
          maxLength={NOTE_MAX}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          className={TEXTAREA_CLASSES}
        />
      </div>
      {formError === null ? null : <ErrorNotice>{formError}</ErrorNotice>}
      <ActionFeedback action={action} />
      {notice === null ? null : (
        <p role="status" className={SUCCESS_CLASSES}>
          {notice}
        </p>
      )}
      <button
        type="submit"
        aria-disabled={action.busy || undefined}
        className={`${SMALL_PRIMARY_CLASSES} self-start`}
      >
        {action.busy ? messages.common.busy : messages.common.send}
      </button>
    </form>
  );
}

function RoleChangeForm({ detail }: { detail: Detail }) {
  const router = useRouter();
  const ids = { legalName: useId(), reason: useId() };
  const action = useAction();
  const [legalName, setLegalName] = useState("");
  const [reason, setReason] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const outcome = roleChangeOutcome(detail.account.id, { legalName, reason });
    if (!outcome.ok) {
      setFormError(outcome.error);
      return;
    }
    setFormError(null);
    void action.run(
      () => requestDualControl(outcome.body),
      (view) => router.push(`/double-validation/${view.id}`),
    );
  }

  return (
    <form
      noValidate
      onSubmit={submit}
      aria-labelledby="role-title"
      className={SECTION_CLASSES}
    >
      <h2 id="role-title" className={SECTION_TITLE}>
        {t.roleChange}
      </h2>
      <p className={HELP_CLASSES}>{t.roleChangeLead}</p>
      <div className={ROW_GROUP_CLASSES}>
        <div className={FIELD_CLASSES}>
          <label htmlFor={ids.legalName} className={SMALL_LABEL_CLASSES}>
            {t.legalName}
          </label>
          <input
            id={ids.legalName}
            type="text"
            maxLength={LEGAL_NAME_MAX}
            value={legalName}
            onChange={(event) => setLegalName(event.target.value)}
            className={inputClasses(false)}
          />
        </div>
        <div className={FIELD_CLASSES}>
          <label htmlFor={ids.reason} className={SMALL_LABEL_CLASSES}>
            {messages.common.reason}
          </label>
          <select
            id={ids.reason}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className={SELECT_CLASSES}
          >
            <option value="">{messages.common.reasonPlaceholder}</option>
            {ROLE_CHANGE_REASONS.map((code) => (
              <option key={code} value={code}>
                {t.roleChangeReasons[code]}
              </option>
            ))}
          </select>
        </div>
      </div>
      {formError === null ? null : <ErrorNotice>{formError}</ErrorNotice>}
      <ActionFeedback action={action} />
      <button
        type="submit"
        aria-disabled={action.busy || undefined}
        className={`${SMALL_PRIMARY_CLASSES} self-start`}
      >
        {t.requestDualControl}
      </button>
    </form>
  );
}

function SuppressionForm({ detail }: { detail: Detail }) {
  const ids = { reason: useId() };
  const action = useAction();
  const [reason, setReason] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const outcome = suppressionOutcome(reason);
    if (!outcome.ok) {
      return;
    }
    setNotice(null);
    void action.run(
      () => liftSuppression(detail.account.id, outcome.body),
      (data) => setNotice(t.suppressionDone(data.resyncQueued)),
      suppressionRefusal,
    );
  }

  return (
    <form
      noValidate
      onSubmit={submit}
      aria-labelledby="suppression-title"
      className={SECTION_CLASSES}
    >
      <h2 id="suppression-title" className={SECTION_TITLE}>
        {t.suppression}
      </h2>
      <p className={HELP_CLASSES}>{t.suppressionLead}</p>
      <div className={FIELD_CLASSES}>
        <label htmlFor={ids.reason} className={SMALL_LABEL_CLASSES}>
          {messages.common.reason}
        </label>
        <select
          id={ids.reason}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          className={`${SELECT_CLASSES} self-start`}
        >
          <option value="">{messages.common.reasonPlaceholder}</option>
          {SUPPRESSION_LIFT_REASONS.map((code) => (
            <option key={code} value={code}>
              {t.suppressionReasons[code]}
            </option>
          ))}
        </select>
      </div>
      <ActionFeedback action={action} />
      {notice === null ? null : (
        <p role="status" className={SUCCESS_CLASSES}>
          {notice}
        </p>
      )}
      <button
        type="submit"
        aria-disabled={
          !suppressionCanSubmit(reason) || action.busy || undefined
        }
        className={`${SMALL_PRIMARY_CLASSES} self-start`}
      >
        {t.suppressionSubmit}
      </button>
    </form>
  );
}

function DataRequests({ detail }: { detail: Detail }) {
  const me = useMe();
  const router = useRouter();
  const action = useAction();

  function approve(request: Detail["dataRequests"][number]) {
    void action.run(
      () =>
        requestDualControl({
          code: "privacy.approve_data_request",
          requestId: request.id,
          requestType: request.type,
          reasonCode: "request_instructed",
        }),
      (view) => router.push(`/double-validation/${view.id}`),
    );
  }

  return (
    <section aria-labelledby="data-title" className={SECTION_CLASSES}>
      <h2 id="data-title" className={SECTION_TITLE}>
        {t.dataRequests}
      </h2>
      {detail.dataRequests.length === 0 ? (
        <p className={HELP_CLASSES}>{t.noDataRequest}</p>
      ) : (
        <ul className="flex flex-col gap-3 text-sm">
          {detail.dataRequests.map((request) => (
            <li key={request.id} className="flex flex-col gap-1">
              <span>
                {t.dataRequestLine(
                  t.dataRequestType[request.type],
                  formatDate(request.receivedAt),
                  formatDate(request.dueAt),
                  request.outcome === null
                    ? t.dataRequestStatus[request.status]
                    : t.dataRequestOutcome[request.outcome],
                )}
              </span>
              {request.execution === null ? null : request.execution
                  .authorisedBy === "member_fresh_code" ? (
                <span>
                  {t.dataRequestMemberErasure(
                    formatDateTime(request.execution.approvedAt),
                    request.execution.executedAt === null
                      ? null
                      : formatDateTime(request.execution.executedAt),
                    messages.syncState[detail.account.sync.brevo.state],
                    messages.syncState[detail.account.sync.apollo.state],
                    request.completedAt === null
                      ? null
                      : formatDateTime(request.completedAt),
                  )}
                </span>
              ) : request.execution.executedAt === null ? (
                <span>
                  {t.dataRequestApproved(
                    formatDateTime(request.execution.approvedAt),
                  )}
                </span>
              ) : (
                <span>
                  {t.dataRequestExecuted(
                    formatDateTime(request.execution.executedAt),
                  )}
                </span>
              )}
              {request.export === null ? null : (
                <span>
                  {t.dataRequestExport(
                    formatDateTime(request.export.expiresAt),
                    request.export.downloads,
                  )}
                </span>
              )}
              {request.status === "closed" ||
              request.execution !== null ? null : me.role === "admin" ? (
                <button
                  type="button"
                  onClick={() => approve(request)}
                  aria-disabled={action.busy || undefined}
                  className={`${SMALL_SECONDARY_CLASSES} self-start`}
                >
                  {t.dataRequestApprove}
                </button>
              ) : (
                <span className={HELP_CLASSES}>{t.dataRequestAgent}</span>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className={HELP_CLASSES}>{t.dataRequestClosing}</p>
      <ActionFeedback action={action} />
    </section>
  );
}

function History({
  events,
  nextBefore,
  onMore,
  busy,
}: {
  events: readonly HistoryEvent[];
  nextBefore: number | null;
  onMore: () => void;
  busy: boolean;
}) {
  return (
    <section aria-labelledby="history-title" className={SECTION_CLASSES}>
      <h2 id="history-title" className={SECTION_TITLE}>
        {t.history}
      </h2>
      {events.length === 0 ? (
        <p className={HELP_CLASSES}>{t.historyEmpty}</p>
      ) : (
        <ol className="flex flex-col gap-1 text-sm">
          {events.map((event) => (
            <li key={event.seq} className="font-mono">
              {t.historyLine(
                formatDateTime(event.occurredAt),
                t.historyActor[event.actorType],
                event.eventType,
              )}
            </li>
          ))}
        </ol>
      )}
      {nextBefore === null ? null : (
        <button
          type="button"
          onClick={onMore}
          aria-disabled={busy || undefined}
          className={`${SMALL_SECONDARY_CLASSES} self-start`}
        >
          {t.historyMore}
        </button>
      )}
    </section>
  );
}

export function AccountScreen({ id }: { id: string }) {
  const me = useMe();
  const router = useRouter();
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [events, setEvents] = useState<HistoryEvent[]>([]);
  const [nextBefore, setNextBefore] = useState<number | null>(null);
  const [moreBusy, setMoreBusy] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    void readAccount(id, null).then((result) => {
      if (!active) {
        return;
      }
      if (result.kind === "ok") {
        setLoad({ kind: "ok", data: result.data });
        setEvents(result.data.history.events);
        setNextBefore(result.data.history.nextBefore);
      } else if (result.kind === "unauthenticated") {
        router.replace("/");
      } else {
        setLoad({
          kind: "error",
          message:
            result.code === "not_found" ? messages.failure.notFound : t.error,
        });
      }
    });
    return () => {
      active = false;
    };
  }, [id, reload, router]);

  async function more() {
    if (nextBefore === null || moreBusy) {
      return;
    }
    setMoreBusy(true);
    try {
      const result = await readAccount(id, nextBefore);
      if (result.kind === "ok") {
        setEvents([...events, ...result.data.history.events]);
        setNextBefore(result.data.history.nextBefore);
      }
    } finally {
      setMoreBusy(false);
    }
  }

  const back = (
    <Link href="/inscrits" className={LINK_CLASSES}>
      {t.back}
    </Link>
  );

  if (load.kind === "loading") {
    return (
      <>
        {back}
        <h1 className={TITLE_CLASSES}>{t.title}</h1>
        <p role="status" className={HELP_CLASSES}>
          {messages.common.loading}
        </p>
      </>
    );
  }
  if (load.kind === "error") {
    return (
      <>
        {back}
        <h1 className={TITLE_CLASSES}>{t.title}</h1>
        <ErrorNotice>{load.message}</ErrorNotice>
      </>
    );
  }

  const detail = load.data;
  const { account } = detail;
  return (
    <>
      {back}
      <h1 className={TITLE_CLASSES}>{t.title}</h1>
      <p role="status" className={HELP_CLASSES}>
        {t.journaled}
      </p>
      <section aria-labelledby="identity-title" className={SECTION_CLASSES}>
        <h2 id="identity-title" className={SECTION_TITLE}>
          {t.identity}
        </h2>
        <dl className={DL_CLASSES}>
          <Field label={t.email}>
            <span className="block break-all">{account.email}</span>
            <span className="block text-text-secondary">
              {t.emailStatus[account.emailStatus]}
            </span>
          </Field>
          {account.companyName === null ? null : (
            <Field label={t.companyName}>{account.companyName}</Field>
          )}
          <Field label={t.role}>{messages.roles[account.role]}</Field>
          <Field label={t.status}>
            {messages.accountStatus[account.status]}
          </Field>
          <Field label={t.country}>{countryName(account.countryCode)}</Field>
          <Field label={t.language}>
            {messages.languages[account.preferredLanguage]}
          </Field>
          <Field label={t.declaredStatus}>
            {messages.declaredStatus[account.declaredStatus]}
          </Field>
          <Field label={t.createdAt}>{formatLongDate(account.createdAt)}</Field>
          <Field label={t.lastSeenAt}>
            {account.lastSeenAt === null
              ? messages.common.none
              : formatDateTime(account.lastSeenAt)}
          </Field>
          <Field label={t.consent}>
            {account.consent === null
              ? t.noConsent
              : t.consentValue(
                  account.consent.granted,
                  formatDateTime(account.consent.occurredAt),
                  messages.consentSource[account.consent.source],
                )}
          </Field>
          <Field label={t.source}>
            <span className="block">
              {account.source.viaInvitation
                ? t.sourceInvitation
                : t.sourceDirect}
            </span>
            {account.source.utmSource === null ? null : (
              <span className="block">
                {t.utm(
                  account.source.utmSource,
                  account.source.utmMedium ?? messages.common.none,
                  account.source.utmCampaign ?? messages.common.none,
                )}
              </span>
            )}
            {account.source.referrerDomain === null ? null : (
              <span className="block">
                {t.referrer(account.source.referrerDomain)}
              </span>
            )}
            {account.source.heardFrom === null ? null : (
              <span className="block">
                {t.heardFrom(messages.heardFrom[account.source.heardFrom])}
              </span>
            )}
          </Field>
          <Field label={t.owner}>
            {detail.ownership.length === 0 ? (
              messages.accounts.unowned
            ) : (
              <ul>
                {detail.ownership.map((entry) => (
                  <li key={`${entry.agentAccountId}-${entry.assignedAt}`}>
                    {t.ownerSince(
                      entry.agentDisplayName ?? t.unnamed,
                      formatDate(entry.assignedAt),
                      entry.unassignedAt === null
                        ? null
                        : formatDate(entry.unassignedAt),
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Field>
        </dl>
      </section>
      <AccountBrandBlocks brand={detail.brand} />
      <AccountBadgesBlock accountId={account.id} />
      {account.role === "creator" || account.role === "advertiser" ? (
        <AccountOpeningBlock accountId={account.id} role={account.role} />
      ) : null}
      <SyncBlock detail={detail} onReplayed={() => setReload(reload + 1)} />
      <CorrectionForm
        detail={detail}
        onCorrected={() => setReload(reload + 1)}
      />
      <DataRequests detail={detail} />
      {me.role === "admin" ? (
        <>
          {account.role === "creator" && account.status === "active" ? (
            <RoleChangeForm detail={detail} />
          ) : null}
          <SuppressionForm detail={detail} />
        </>
      ) : (
        <AdminOnlyNotice />
      )}
      <History
        events={events}
        nextBefore={nextBefore}
        onMore={() => void more()}
        busy={moreBusy}
      />
    </>
  );
}
