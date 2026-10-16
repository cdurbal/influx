"use client";

// Internal accounts and their invitations, admin only (docs/mvp/15 RG99, RG101, RG103, RG106; 17b
// §3.13.a, §3.13.b; 03 MFA-1, B-8). One named person per account; no sign-up, an invitation only.
// The break-glass account is in the list, never hidden, under its permanent notice (17b §3.13.b).
// Creating an invitation asks for R (apps/api); an admin invitation is usable only once its dual
// control is confirmed (EC-J8-12): the screen leads there.
import {
  INTERNAL_INVITATION_REASONS,
  type InternalAccountsResponse,
  type InternalInvitationCreated,
  type InternalInvitationsResponse,
} from "@influx/contracts/backoffice-invitations";
import { INTERNAL_ROLES } from "@influx/contracts/backoffice-auth";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState, type FormEvent } from "react";
import { messages } from "@/messages/fr";
import {
  ERROR_CLASSES,
  HELP_CLASSES,
  inputClasses,
  INFO_CLASSES,
  TITLE_CLASSES,
  WARNING_CLASSES,
} from "./auth-classes";
import { ActionFeedback } from "./ActionFeedback";
import {
  createInternalInvitation,
  readInternalAccounts,
  readInternalInvitations,
} from "./backoffice-api";
import {
  FIELD_CLASSES,
  LINK_CLASSES,
  ROW_GROUP_CLASSES,
  SECTION_CLASSES,
  SECTION_TITLE_CLASSES,
  SELECT_CLASSES,
  SMALL_LABEL_CLASSES,
  SMALL_PRIMARY_CLASSES,
  TABLE_CLASSES,
  TABLE_WRAP_CLASSES,
  TD_CLASSES,
  TH_CLASSES,
} from "./bo-classes";
import { LinkOnce, RevokeControl } from "./InvitationParts";
import { useAction } from "./use-action";
import { EMAIL_SHAPE, formatDateTime, formatDay } from "./view-model";

const t = messages.internalAccounts;
const ti = messages.invitations;
type Account = InternalAccountsResponse["accounts"][number];
type Invitation = InternalInvitationsResponse["invitations"][number];

function stateOf(account: Account): string {
  if (account.breakGlass) {
    return t.breakGlassState;
  }
  if (!account.active) {
    return t.inactive;
  }
  return account.absence === null
    ? t.active
    : t.absence(formatDay(account.absence.from), formatDay(account.absence.to));
}

function InviteForm({ onCreated }: { onCreated: () => void }) {
  const ids = { email: useId(), role: useId(), reason: useId() };
  const action = useAction();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<(typeof INTERNAL_ROLES)[number]>("agent");
  const [reason, setReason] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [created, setCreated] = useState<InternalInvitationCreated | null>(
    null,
  );

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!EMAIL_SHAPE.test(email.trim())) {
      setFormError(ti.emailInvalid);
      return;
    }
    if (reason === "") {
      setFormError(messages.common.reasonPlaceholder);
      return;
    }
    setFormError(null);
    setCreated(null);
    void action.run(
      () =>
        createInternalInvitation({
          email: email.trim(),
          role,
          reasonCode: reason as (typeof INTERNAL_INVITATION_REASONS)[number],
        }),
      (data) => {
        setCreated(data);
        setEmail("");
        onCreated();
      },
      (code) => (code === "forbidden" ? ti.refusedInternal : null),
    );
  }

  return (
    <form
      noValidate
      onSubmit={submit}
      aria-labelledby="invite-title"
      className={SECTION_CLASSES}
    >
      <h2 id="invite-title" className={SECTION_TITLE_CLASSES}>
        {ti.internalTitle}
      </h2>
      <p className={HELP_CLASSES}>{ti.internalLead}</p>
      <div className={ROW_GROUP_CLASSES}>
        <div className={FIELD_CLASSES}>
          <label htmlFor={ids.email} className={SMALL_LABEL_CLASSES}>
            {ti.email}
          </label>
          <input
            id={ids.email}
            type="email"
            spellCheck={false}
            autoComplete="off"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={inputClasses(false)}
          />
        </div>
        <div className={FIELD_CLASSES}>
          <label htmlFor={ids.role} className={SMALL_LABEL_CLASSES}>
            {ti.role}
          </label>
          <select
            id={ids.role}
            value={role}
            onChange={(event) =>
              setRole(event.target.value as (typeof INTERNAL_ROLES)[number])
            }
            className={SELECT_CLASSES}
          >
            {INTERNAL_ROLES.map((value) => (
              <option key={value} value={value}>
                {messages.roles[value]}
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
            {INTERNAL_INVITATION_REASONS.map((code) => (
              <option key={code} value={code}>
                {ti.reasons[code]}
              </option>
            ))}
          </select>
        </div>
      </div>
      {formError === null ? null : (
        <p role="alert" className={ERROR_CLASSES}>
          {formError}
        </p>
      )}
      <ActionFeedback action={action} />
      <button
        type="submit"
        aria-disabled={action.busy || undefined}
        className={`${SMALL_PRIMARY_CLASSES} self-start`}
      >
        {action.busy ? messages.common.busy : ti.create}
      </button>
      {created === null ? null : (
        <>
          <LinkOnce link={created.link} expiresAt={created.expiresAt} />
          {created.dualControlRequestId === null ? null : (
            <p className={INFO_CLASSES}>
              {ti.adminPending}{" "}
              <Link
                href={`/double-validation/${created.dualControlRequestId}`}
                className={LINK_CLASSES}
              >
                {ti.openDualControl}
              </Link>
            </p>
          )}
        </>
      )}
    </form>
  );
}

export function InternalAccountsScreen() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [invitations, setInvitations] = useState<Invitation[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    void Promise.all([readInternalAccounts(), readInternalInvitations()]).then(
      ([team, invited]) => {
        if (!active) {
          return;
        }
        if (
          team.kind === "unauthenticated" ||
          invited.kind === "unauthenticated"
        ) {
          router.replace("/");
          return;
        }
        if (team.kind !== "ok" || invited.kind !== "ok") {
          const forbidden =
            (team.kind === "failed" && team.code === "forbidden") ||
            (invited.kind === "failed" && invited.code === "forbidden");
          setError(forbidden ? messages.failure.forbidden : t.error);
          return;
        }
        setAccounts(team.data.accounts);
        setInvitations(invited.data.invitations);
      },
    );
    return () => {
      active = false;
    };
  }, [reload, router]);

  return (
    <>
      <h1 className={TITLE_CLASSES}>{t.title}</h1>
      <p className={INFO_CLASSES}>{t.namedPerson}</p>
      <p className={INFO_CLASSES}>{t.byInvitation}</p>
      {accounts?.some((account) => account.breakGlass) ? (
        <p className={WARNING_CLASSES}>{t.breakGlass}</p>
      ) : null}
      {error !== null ? (
        <p role="alert" className={ERROR_CLASSES}>
          {error}
        </p>
      ) : accounts === null || invitations === null ? (
        <p role="status" className={HELP_CLASSES}>
          {messages.common.loading}
        </p>
      ) : (
        <>
          <div className={TABLE_WRAP_CLASSES}>
            <table className={TABLE_CLASSES}>
              <caption className="sr-only">{t.title}</caption>
              <thead>
                <tr>
                  {(
                    ["person", "role", "factor", "owned", "state"] as const
                  ).map((column) => (
                    <th key={column} scope="col" className={TH_CLASSES}>
                      {t.columns[column]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {accounts.map((account) => (
                  <tr key={account.id}>
                    <td className={TD_CLASSES}>
                      <span className="block font-semibold">
                        {account.firstName ?? messages.common.none}
                      </span>
                      <span className="block break-all text-text-secondary">
                        {account.email}
                      </span>
                    </td>
                    <td className={TD_CLASSES}>
                      {messages.roles[account.role]}
                    </td>
                    <td className={TD_CLASSES}>
                      {account.secondFactorActive
                        ? t.factorActive
                        : t.factorMissing}
                    </td>
                    <td className={`${TD_CLASSES} tabular-nums`}>
                      {t.owned(account.ownedAccounts)}
                    </td>
                    <td className={TD_CLASSES}>{stateOf(account)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className={HELP_CLASSES}>{t.lastSignInLater}</p>
          <InviteForm onCreated={() => setReload(reload + 1)} />
          <section aria-labelledby="internal-list" className={SECTION_CLASSES}>
            <h2 id="internal-list" className={SECTION_TITLE_CLASSES}>
              {ti.listTitle}
            </h2>
            {invitations.length === 0 ? (
              <p className={HELP_CLASSES}>{ti.empty}</p>
            ) : (
              <div className={TABLE_WRAP_CLASSES}>
                <table className={TABLE_CLASSES}>
                  <caption className="sr-only">{ti.listTitle}</caption>
                  <thead>
                    <tr>
                      {(
                        [
                          "email",
                          "role",
                          "created",
                          "expires",
                          "state",
                          "action",
                        ] as const
                      ).map((column) => (
                        <th key={column} scope="col" className={TH_CLASSES}>
                          {ti.columns[column]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {invitations.map((invitation) => (
                      <tr key={invitation.id}>
                        <td className={`${TD_CLASSES} break-all`}>
                          {invitation.email}
                        </td>
                        <td className={TD_CLASSES}>
                          {messages.roles[invitation.role]}
                        </td>
                        <td className={`${TD_CLASSES} tabular-nums`}>
                          {formatDateTime(invitation.createdAt)}
                        </td>
                        <td className={`${TD_CLASSES} tabular-nums`}>
                          {formatDateTime(invitation.expiresAt)}
                        </td>
                        <td className={TD_CLASSES}>
                          {ti.internalStates[invitation.state]}
                          {invitation.state === "awaiting_dual_control" &&
                          invitation.dualControlRequestId !== null ? (
                            <Link
                              href={`/double-validation/${invitation.dualControlRequestId}`}
                              className={`${LINK_CLASSES} block`}
                            >
                              {ti.openDualControl}
                            </Link>
                          ) : null}
                        </td>
                        <td className={TD_CLASSES}>
                          {invitation.state === "pending" ||
                          invitation.state === "awaiting_dual_control" ? (
                            <RevokeControl
                              kind="internal"
                              id={invitation.id}
                              email={invitation.email}
                              onRevoked={() => setReload(reload + 1)}
                            />
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </>
  );
}
