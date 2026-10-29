"use client";

// Member invitations, agent and admin (docs/mvp/05 RG116 to RG119, D54; 21 EC-J8-2, EC-J8-3,
// EC-J8-31). The proposed role is only proposed: the person chooses at sign-up (RG117). The link is
// shown once and copied by the agent, who becomes the responsible salesperson of the account
// created with it. An agent lists their own invitations; an admin lists every one (apps/api).
import {
  MEMBER_INVITATION_ROLES,
  type MemberInvitationCreated,
  type MemberInvitationsResponse,
} from "@influx/contracts/backoffice-invitations";
import { UI_LOCALES } from "@influx/contracts/auth";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState, type FormEvent } from "react";
import { messages } from "@/messages/fr";
import {
  HELP_CLASSES,
  inputClasses,
  LEAD_CLASSES,
  TITLE_CLASSES,
} from "./auth-classes";
import { ActionFeedback } from "./ActionFeedback";
import {
  createMemberInvitation,
  readMemberInvitations,
} from "./backoffice-api";
import {
  FIELD_CLASSES,
  ROW_GROUP_CLASSES,
  SECTION_CLASSES,
  SECTION_TITLE_CLASSES,
  SELECT_CLASSES,
  SMALL_LABEL_CLASSES,
  SMALL_PRIMARY_CLASSES,
  TABLE_CLASSES,
  DENSE_TABLE_WRAP_CLASSES,
  TD_CLASSES,
  TH_CLASSES,
} from "./bo-classes";
import { LinkOnce, RevokeControl } from "./InvitationParts";
import { useAction } from "./use-action";
import { EMAIL_SHAPE, formatDateTime } from "./view-model";
import { ErrorNotice } from "./ErrorNotice";

const t = messages.invitations;
type Invitation = MemberInvitationsResponse["invitations"][number];
type ProposedRole = (typeof MEMBER_INVITATION_ROLES)[number];
type Language = (typeof UI_LOCALES)[number];

export function MemberInvitationsScreen() {
  const router = useRouter();
  const ids = { email: useId(), role: useId(), language: useId() };
  const action = useAction();
  const [invitations, setInvitations] = useState<Invitation[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [reload, setReload] = useState(0);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<ProposedRole>("creator");
  const [language, setLanguage] = useState<Language>("fr");
  const [formError, setFormError] = useState<string | null>(null);
  const [created, setCreated] = useState<MemberInvitationCreated | null>(null);

  useEffect(() => {
    let active = true;
    void readMemberInvitations().then((result) => {
      if (!active) {
        return;
      }
      if (result.kind === "ok") {
        setInvitations(result.data.invitations);
      } else if (result.kind === "unauthenticated") {
        router.replace("/");
      } else {
        setLoadError(true);
      }
    });
    return () => {
      active = false;
    };
  }, [reload, router]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!EMAIL_SHAPE.test(email.trim())) {
      setFormError(t.emailInvalid);
      return;
    }
    setFormError(null);
    setCreated(null);
    void action.run(
      () =>
        createMemberInvitation({
          email: email.trim(),
          proposedRole: role,
          preferredLanguage: language,
        }),
      (data) => {
        setCreated(data);
        setEmail("");
        setReload(reload + 1);
      },
      (code) => (code === "conflict" ? t.takenMember : null),
    );
  }

  return (
    <>
      <h1 className={TITLE_CLASSES}>{t.memberTitle}</h1>
      <p className={LEAD_CLASSES}>{t.memberLead}</p>
      <form
        noValidate
        onSubmit={submit}
        aria-labelledby="member-invite-title"
        className={SECTION_CLASSES}
      >
        <h2 id="member-invite-title" className={SECTION_TITLE_CLASSES}>
          {t.create}
        </h2>
        <div className={ROW_GROUP_CLASSES}>
          <div className={FIELD_CLASSES}>
            <label htmlFor={ids.email} className={SMALL_LABEL_CLASSES}>
              {t.email}
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
              {t.proposedRole}
            </label>
            <select
              id={ids.role}
              value={role}
              onChange={(event) => setRole(event.target.value as ProposedRole)}
              className={SELECT_CLASSES}
            >
              {MEMBER_INVITATION_ROLES.map((value) => (
                <option key={value} value={value}>
                  {messages.roles[value]}
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
              onChange={(event) => setLanguage(event.target.value as Language)}
              className={SELECT_CLASSES}
            >
              {UI_LOCALES.map((value) => (
                <option key={value} value={value}>
                  {messages.languages[value]}
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
          {action.busy ? messages.common.busy : t.create}
        </button>
        {created === null ? null : (
          <LinkOnce link={created.link} expiresAt={created.expiresAt} />
        )}
      </form>
      <section aria-labelledby="member-list" className={SECTION_CLASSES}>
        <h2 id="member-list" className={SECTION_TITLE_CLASSES}>
          {t.listTitle}
        </h2>
        {loadError ? (
          <ErrorNotice>{t.error}</ErrorNotice>
        ) : invitations === null ? (
          <p role="status" className={HELP_CLASSES}>
            {messages.common.loading}
          </p>
        ) : invitations.length === 0 ? (
          <p className={HELP_CLASSES}>{t.empty}</p>
        ) : (
          <div
            role="region"
            aria-label={t.listTitle}
            // a scrollable region must be reachable by keyboard (axe scrollable-region-focusable)
            // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
            tabIndex={0}
            className={DENSE_TABLE_WRAP_CLASSES}
          >
            <table className={TABLE_CLASSES}>
              <caption className="sr-only">{t.listTitle}</caption>
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
                      {t.columns[column]}
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
                      {messages.roles[invitation.proposedRole]}
                    </td>
                    <td className={`${TD_CLASSES} tabular-nums`}>
                      {formatDateTime(invitation.createdAt)}
                    </td>
                    <td className={`${TD_CLASSES} tabular-nums`}>
                      {formatDateTime(invitation.expiresAt)}
                    </td>
                    <td className={TD_CLASSES}>
                      {t.memberStates[invitation.state]}
                    </td>
                    <td className={TD_CLASSES}>
                      {invitation.state === "pending" ? (
                        <RevokeControl
                          kind="member"
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
  );
}
