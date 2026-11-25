"use client";

// The block « Badges » of the record of a member account (docs/mvp/08 RG70, RG73 to RG77; 06 RG55; 15
// RG75; 17b §3.6, §3.13.c; jalons/l2f, commit 18): every badge of the account whatever its state, written
// (a colour never carries a state alone), with its date and, for a badge that stands, the ask for its
// withdrawal. Nothing is withdrawn here: the ask opens a double validation that an administrator other than
// the asker confirms on its own screen (03 PD2, EC-L2F-4). The block shows no figure and no identifier of
// a network (the dossier of the queue holds the exact ones, whose reading is journaled). A separate file
// so that AccountScreen.tsx only calls it (it is not to grow, L2C fiche § risks).
import {
  VERIFICATION_MEMBER_MESSAGE_MAX_LENGTH,
  VERIFICATION_MEMBER_MESSAGE_MIN_LENGTH,
  type AccountBadgeRow,
  type AccountBadgesResponse,
} from "@influx/contracts/verification";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { messages } from "@/messages/fr";
import { HELP_CLASSES } from "./auth-classes";
import { ActionFeedback } from "./ActionFeedback";
import {
  badgeName,
  canRequestWithdrawal,
  dateWords,
  disputeWords,
  hasLiveRequest,
  pendingWords,
  reasonWords,
  reasonsFor,
  recapLines,
  revokedForWords,
  sortedBadges,
  stateWords,
  withdrawalOutcome,
  withdrawalRefusal,
} from "./account-badges-view";
import { readAccountBadges, requestBadgeRevocation } from "./backoffice-api";
import {
  FIELD_CLASSES,
  LINK_CLASSES,
  SECTION_CLASSES,
  SECTION_TITLE,
  SELECT_CLASSES,
  SMALL_LABEL_CLASSES,
  SMALL_PRIMARY_CLASSES,
  SMALL_SECONDARY_CLASSES,
  SUCCESS_CLASSES,
  TABLE_CLASSES,
  TD_CLASSES,
  TEXTAREA_CLASSES,
  TH_CLASSES,
} from "./bo-classes";
import { DenseTableRegion } from "./DenseTableRegion";
import { ErrorNotice } from "./ErrorNotice";
import { useMe } from "./Shell";
import { useAction } from "./use-action";
import { formatDate } from "./view-model";

const t = messages.accountBadges;

type Load =
  | { kind: "loading" }
  | { kind: "ok"; data: AccountBadgesResponse }
  | { kind: "error" };

function WithdrawalForm({
  accountId,
  badge,
  reasons,
  onCancel,
  onSent,
}: {
  accountId: string;
  badge: AccountBadgeRow;
  reasons: AccountBadgesResponse["reasons"];
  onCancel: () => void;
  onSent: (dualControlRequestId: string) => void;
}) {
  const ids = { reason: useId(), message: useId() };
  const reasonField = useRef<HTMLSelectElement>(null);
  const action = useAction();
  const [reasonCode, setReasonCode] = useState("");
  const [memberMessage, setMemberMessage] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const offered = reasonsFor(reasons, badge.level);
  const chosen = offered.find((reason) => reason.code === reasonCode);

  // the keyboard lands on the first field when the form opens
  useEffect(() => {
    reasonField.current?.focus();
  }, []);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const outcome = withdrawalOutcome({
      badge,
      reasons,
      reasonCode,
      memberMessage,
    });
    if (!outcome.ok) {
      setFormError(outcome.error);
      return;
    }
    setFormError(null);
    void action.run(
      () => requestBadgeRevocation(accountId, badge.id, outcome.body),
      (data) => onSent(data.dualControlRequestId),
      withdrawalRefusal,
    );
  }

  return (
    <form
      noValidate
      onSubmit={submit}
      aria-labelledby="badge-withdrawal-title"
      className={SECTION_CLASSES}
    >
      <h3
        id="badge-withdrawal-title"
        className="font-display text-sm font-bold text-text-primary"
      >
        {t.formTitle(badgeName(badge))}
      </h3>
      <p className={HELP_CLASSES}>{t.formLead}</p>
      <div className={FIELD_CLASSES}>
        <label htmlFor={ids.reason} className={SMALL_LABEL_CLASSES}>
          {t.reason}
        </label>
        <select
          ref={reasonField}
          id={ids.reason}
          value={reasonCode}
          onChange={(event) => setReasonCode(event.target.value)}
          className={`${SELECT_CLASSES} self-start`}
        >
          <option value="">{t.reasonPlaceholder}</option>
          {offered.map((reason) => (
            <option key={reason.code} value={reason.code}>
              {reasonWords(reason.code)}
            </option>
          ))}
        </select>
      </div>
      {chosen === undefined ? null : (
        <>
          {chosen.escalatesToAdmin ? (
            <p className={HELP_CLASSES}>{t.escalated}</p>
          ) : null}
          {chosen.requiresMemberMessage ? (
            <div className={FIELD_CLASSES}>
              <label htmlFor={ids.message} className={SMALL_LABEL_CLASSES}>
                {t.memberMessage(
                  VERIFICATION_MEMBER_MESSAGE_MIN_LENGTH,
                  VERIFICATION_MEMBER_MESSAGE_MAX_LENGTH,
                )}
              </label>
              <textarea
                id={ids.message}
                maxLength={VERIFICATION_MEMBER_MESSAGE_MAX_LENGTH}
                value={memberMessage}
                onChange={(event) => setMemberMessage(event.target.value)}
                className={TEXTAREA_CLASSES}
              />
            </div>
          ) : null}
          <p className={HELP_CLASSES}>{t.memberReceives}</p>
          <blockquote
            data-member-sentence
            className="border-l-(length:--border-width-thick) border-border-strong pl-3 text-sm text-text-primary"
          >
            {chosen.message}
          </blockquote>
        </>
      )}
      <p className="text-sm font-semibold text-text-primary">{t.recapTitle}</p>
      <ul className="list-disc pl-6 text-sm text-text-primary">
        {recapLines(badge).map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      {formError === null ? null : <ErrorNotice>{formError}</ErrorNotice>}
      <ActionFeedback action={action} />
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onCancel}
          className={SMALL_SECONDARY_CLASSES}
        >
          {t.cancel}
        </button>
        <button
          type="submit"
          aria-disabled={action.busy || undefined}
          className={SMALL_PRIMARY_CLASSES}
        >
          {action.busy ? t.busy : t.submit}
        </button>
      </div>
    </form>
  );
}

export function AccountBadgesBlock({ accountId }: { accountId: string }) {
  const me = useMe();
  const router = useRouter();
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [reload, setReload] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void readAccountBadges(accountId).then((result) => {
      if (!active) {
        return;
      }
      if (result.kind === "ok") {
        setLoad({ kind: "ok", data: result.data });
      } else if (result.kind === "unauthenticated") {
        router.replace("/");
      } else {
        setLoad({ kind: "error" });
      }
    });
    return () => {
      active = false;
    };
  }, [accountId, reload, router]);

  function sent(dualControlRequestId: string) {
    setSelected(null);
    // the 2V screens are the administrator's (03 PD2): he goes on to confirm, an agent waits for one
    if (me.role === "admin") {
      router.push(`/double-validation/${dualControlRequestId}`);
      return;
    }
    setNotice(t.sentAgent);
    setReload((count) => count + 1);
  }

  const body = (() => {
    if (load.kind === "loading") {
      return (
        <p role="status" className={HELP_CLASSES}>
          {t.loading}
        </p>
      );
    }
    if (load.kind === "error") {
      return <ErrorNotice>{t.error}</ErrorNotice>;
    }
    const { badges, reasons } = load.data;
    if (badges.length === 0) {
      return <p className={HELP_CLASSES}>{t.empty}</p>;
    }
    const rows = sortedBadges(badges);
    const picked = rows.find((badge) => badge.id === selected) ?? null;
    return (
      <>
        <DenseTableRegion label={t.tableLabel}>
          <table className={TABLE_CLASSES}>
            <caption className="sr-only">{t.tableLabel}</caption>
            <thead>
              <tr>
                {(["badge", "state", "granted", "date", "action"] as const).map(
                  (column) => (
                    <th key={column} scope="col" className={TH_CLASSES}>
                      {t.columns[column]}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((badge) => {
                const pending = pendingWords(badge);
                const revoked = revokedForWords(badge);
                const dispute = disputeWords(badge);
                return (
                  <tr key={badge.id} data-badge-row={badge.state}>
                    <td className={TD_CLASSES}>{badgeName(badge)}</td>
                    <td className={TD_CLASSES}>
                      <span className="block font-semibold">
                        {stateWords(badge.state)}
                      </span>
                      {revoked === null ? null : (
                        <span className="block">{revoked}</span>
                      )}
                      {pending === null ? null : (
                        <span className="block">
                          {pending}
                          {badge.pendingRevocation !== null &&
                          me.role === "admin" &&
                          hasLiveRequest(badge) ? (
                            <>
                              {" "}
                              <Link
                                href={`/double-validation/${badge.pendingRevocation.dualControlRequestId}`}
                                className={LINK_CLASSES}
                              >
                                {t.openRequest}
                              </Link>
                            </>
                          ) : null}
                        </span>
                      )}
                      {dispute === null ? null : (
                        <span className="block">{dispute}</span>
                      )}
                    </td>
                    <td className={`${TD_CLASSES} tabular-nums`}>
                      {formatDate(badge.grantedAt)}
                    </td>
                    <td className={TD_CLASSES}>{dateWords(badge)}</td>
                    <td className={TD_CLASSES}>
                      {canRequestWithdrawal(badge) ? (
                        <button
                          type="button"
                          aria-label={t.requestWithdrawalOf(badgeName(badge))}
                          aria-expanded={selected === badge.id}
                          onClick={() => {
                            setNotice(null);
                            setSelected(badge.id);
                          }}
                          className={SMALL_SECONDARY_CLASSES}
                        >
                          {t.requestWithdrawal}
                        </button>
                      ) : (
                        messages.common.none
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </DenseTableRegion>
        {picked === null ? null : (
          <WithdrawalForm
            key={picked.id}
            accountId={accountId}
            badge={picked}
            reasons={reasons}
            onCancel={() => setSelected(null)}
            onSent={sent}
          />
        )}
      </>
    );
  })();

  return (
    <section aria-labelledby="badges-title" className={SECTION_CLASSES}>
      <h2 id="badges-title" className={SECTION_TITLE}>
        {t.title}
      </h2>
      <p className={HELP_CLASSES}>{t.lead}</p>
      {notice === null ? null : (
        <p role="status" className={SUCCESS_CLASSES}>
          {notice}
        </p>
      )}
      {body}
    </section>
  );
}
