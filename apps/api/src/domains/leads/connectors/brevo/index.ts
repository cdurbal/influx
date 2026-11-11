// The two Brevo connectors of the worker (J6, commit 4): `brevo_contact` (16 §M1 operations 1, 2
// and 7, and the address change of J7 decision 5) and `brevo_transactional` (operation 6, the
// welcome e-mails of 05 RG86 and the notice of a changed address of RG58, P1 of 16 §H). Since D69
// (founder, 2026-10-18), EVERY queue e-mail is written by INFLUX from its translation files and
// Brevo only carries it (16 RG67): no Brevo template is referenced any more.
// Their preparation, at consumption (05 RG37), in this order:
//   1. the account state of the attempt: an account gone or not active is skipped;
//   2. the qualification: contact without marketing consent (RG80) is skipped no_consent at sign-up,
//      and unsubscribed afterwards (RG78: a withdrawal is never doubled by a later send); the
//      welcome leaves whatever the consent (RG86), once per account (RG76, 16 RG90);
//   3. the subject's own read (leads.read_brevo_subject, 0112), in its own short transaction: a
//      withdrawal or a suppression is unsubscribed, which needs no list (05 RG160 point 5);
//   4. the settings read at consumption (EC-8): the list of the role, never guessed (0103); missing,
//      it is named with the mapping (05 RG164) and the drain FAILS the line, an incident (RG160),
//      after the would_send trace of dry_run and the output check;
//   5. the mapping of 16 §M4 and the output check (RG137): a refusal goes back to the drain, which
//      fails the line, in dry_run as in live;
//   6. BREVO_MODE=redirect: an address outside BREVO_TEST_RECIPIENTS is skipped_non_production
//      (16 RG117, a positive condition, after the whole mapping).
// A contact under suppression (05 RG93, a complaint) is only ever unsubscribed again, whatever the
// consent: an ordinary replay never resynchronises it (CA55); only an admin lifts it (J8).
// email.changed (05 RG58, decision 5 of J7): the contact is updated by its Brevo id, else by its old
// address, never recreated; Brevo lifts the blacklist on an address change, so operations 2 and 7
// follow when the consent is withdrawn or the contact suppressed. The notice auth.email_changed_notice
// goes to the address its payload names (`previous`: the old address of the completed request,
// read by the subject read, never carried by the line; `current`: the account's), whatever the
// consent (a transactional e-mail, RG35). Every queue e-mail is refused if anything in it looks like
// a link (RG158, extended by D69): the welcome e-mails (once per account, RG76), the notice,
// auth.new_device (05 RG142, 16 RG157, J7 commit 8), privacy.request_received (16 RG160, EC-14;
// architecte, 2026-10-14), from the request read at consumption: a request of another type fails
// unsupported_request_type, a request closed since is skipped request_closed; and so is
// privacy.export_ready (J8 commit 8: where and until when the export is downloadable, no link).
// privacy.erasure_completed (D72, 16 RG160 bis) is the answer to an erasure: it leaves AFTER the
// account is erased, so it comes before the account step too, to the address the execution holds
// until the e-mail has its messageId (privacy.read_erasure_notification_subject, E-5 pool).
// account.deleted (04 §9.2, 15 RG79, J8 commit 8): operation 2 deletes the contact of an ERASED
// account, by its Brevo id, else by the address the request holds until Brevo confirms (0136); it
// comes before the account step, since the account is no longer active by construction.
// profile.decision (06 RG66, RG69; L2C commit 09): the answer to the examination of a brand profile,
// from the decision read at consumption (leads.read_brevo_profile_decision, 0211) and the address of
// the subject read; the agent's message (reason `other`) is escaped and refused if it looks like a
// link (RG158).
// profile.completed (06 RG78, CA40 to CA42; L2C commit 10): the first publication of a brand rewrites the
// contact as lead.updated does, from the live profile read at consumption (leads.read_brand_profile_attributes,
// 0212; RG79: sector, size band, markets, state, completeness, first topic, funnel stage); without
// marketing consent it is skipped no_consent, as lead.created is, and never counted as a failure.
// verification.received, .code_issued, .decision and .request_expired (08 RG94, EC-L2E-3; L2E commit 16):
// the five e-mails of the verification, written like profile.decision from the facts read at
// consumption (leads.read_brevo_verification_email, 0227) and the address of the subject read: a
// request cancelled, a code revoked or past its date is skipped (never announced), a reason outside
// the closed list, a granted badge without its date or an `other` refusal without its message is a
// visible failure. Every contact upsert carries the level of the account's badge and its date
// (VERIFIED_LEVEL, VERIFIED_AT; leads.read_verified_badge, 0227; Brevo only, 08 RG92).
// The eight e-mails of the life of the badge (08 RG93, RG94; L2F commit 12): verification.expiry_reminder,
// .expiry_to_refresh, .expiry_removed, .revoked_notice, .dispute_received, .dispute_outcome,
// .reconfirm_required and .agent_opened_notice, written from the facts read at consumption
// (leads.read_brevo_badge_email, 0236) and never from the payload (ids only). A badge replaced or
// ended since the line was queued, an appeal withdrawn, a proof no longer required is skipped (never
// announced); a reason or outcome outside the closed lists, or a message that is required and
// absent, is a visible failure.
// creator_profile.decision and portfolio.decision (07 RG96, RG97, RG99; EC-L2G-8; L2G commit 10): the
// answer to the examination of a creator profile (a submission or a revision of a published one) and
// to the moderation of one visual, written like profile.decision from the facts read at consumption
// (leads.read_brevo_creator_profile_decision and read_brevo_portfolio_decision, 0245) and never from
// the payload (ids only): a decision, reason or kind outside the closed lists, or `other` without its
// message, is a visible failure. The contact of a creator carries the attributes of RG107 from the
// live storefront (leads.read_creator_profile_attributes, 0245), read on a Brevo contact line only
// (the base refuses an Apollo line, RG109); absent, they are sent empty (RG110).
// What leaves for the drain is names and verdicts; the values stay in the closure of `send`.
import {
  UNIDENTIFIED_USER_AGENT,
  userAgentSummarySchema,
} from "@influx/contracts/user-agent";
import type { BrevoMode } from "../../../../config/schema.ts";
import { renderDataRequestReceivedEmail } from "../../../identity/data-request-received-email.ts";
import { renderEmailChangedNoticeEmail } from "../../../identity/email-changed-notice-email.ts";
import type { RenderedEmail } from "../../../identity/login-code-email.ts";
import { renderNewDeviceEmail } from "../../../identity/new-device-email.ts";
import { renderWelcomeEmail } from "../../../identity/welcome-email.ts";
import { renderErasureCompletedEmail } from "../../../privacy/erasure-completed-email.ts";
import type { ErasureNotificationSubject } from "../../../privacy/erasure-notification-subject.ts";
import { renderExportReadyEmail } from "../../../privacy/export-ready-email.ts";
import {
  renderBrandDecisionEmail,
  rejectionReasonOf,
} from "../../../profiles/brand-decision-email.ts";
import {
  creatorRejectionReasonOf,
  portfolioRejectionReasonOf,
  renderCreatorProfileDecisionEmail,
  renderPortfolioDecisionEmail,
} from "../../../profiles/creator/decision-email.ts";
import {
  disputeOutcomeOf,
  renderBadgeNoticeEmail,
  revocationReasonOf,
  type BadgeNoticeInput,
  type ContestedReason,
} from "../../../verification/badge-notice-email.ts";
import {
  renderVerificationEmail,
  verificationLevelOf,
  verificationNetworkOf,
  verificationReasonOf,
} from "../../../verification/verification-email.ts";
import {
  accountSkip,
  type CallDescription,
  type Connector,
  type Preparation,
} from "../../connector.ts";
import type {
  AttemptState,
  BrandProfileAttributes,
  BrevoCreatorProfileDecision,
  BrevoErasureSubject,
  BrevoPortfolioDecision,
  BrevoProfileDecision,
  BrevoBadgeEmail,
  BrevoVerificationEmail,
  ClaimedLine,
  CreatorProfileAttributes,
  VerifiedBadge,
} from "../../repository.ts";
import {
  brevoListIdOf,
  brevoListPathOf,
  configurationFailureCode,
} from "../../settings.ts";
import {
  createBrevoClient,
  type BrevoClient,
  type BrevoClientLogger,
  type BrevoContactIdentifier,
} from "./client.ts";
import {
  checkContactOutput,
  checkEmailChangeOutput,
  checkRenderedTransactionalOutput,
  languageOf,
  mapContact,
  UNSUBSCRIBE_BODY_FIELDS,
  type BrevoSubject,
} from "./mapping.ts";

export {
  BREVO_CONTACT_ATTRIBUTES,
  checkContactOutput,
  checkEmailChangeOutput,
  checkRenderedTransactionalOutput,
  checkTransactionalOutput,
  mapContact,
  type BrevoSubject,
} from "./mapping.ts";

/**
 * The queue e-mails, all written by INFLUX itself (16 RG67, D69), without any template nor link
 * (RG158): the welcome e-mails (J6), the notice of a changed address (J7), and the rest.
 */
export const WORKER_RENDERED_EMAILS = [
  "account.welcome_advertiser",
  "account.welcome_creator",
  "auth.email_changed_notice",
  "auth.new_device",
  "privacy.request_received",
  "privacy.export_ready",
  "privacy.erasure_completed",
  "profile.decision",
  "creator_profile.decision",
  "portfolio.decision",
  "verification.received",
  "verification.code_issued",
  "verification.decision",
  "verification.request_expired",
  "verification.expiry_reminder",
  "verification.expiry_to_refresh",
  "verification.expiry_removed",
  "verification.revoked_notice",
  "verification.dispute_received",
  "verification.dispute_outcome",
  "verification.reconfirm_required",
  "verification.agent_opened_notice",
] as const;

type RenderedEmailCode = (typeof WORKER_RENDERED_EMAILS)[number];

/** The e-mails of an active account, read through its subject (the others have their own read). */
type AccountEmailCode = Exclude<RenderedEmailCode, "privacy.erasure_completed">;

/** Sender name of the transactional flow (16 RG156). */
const SENDER_NAME = "INFLUX";

export type BrevoConnectorSettings = {
  mode: BrevoMode;
  /** BREVO_TEST_RECIPIENTS: the only addresses reached in redirect (16 RG117). */
  testRecipients: readonly string[];
  /** The worker's OWN key (EC-19), null when absent. */
  apiKey: string | null;
  baseUrl: string;
  senderTransactional: string | null;
  /** BREVO_SUPPRESSION_LIST_ID: the marketing exclusion list (16 RG45), or none. */
  suppressionListId: number | null;
};

export type BrevoSubjectReader = (
  line: ClaimedLine,
) => Promise<BrevoSubject | null>;

/** The decision of a profile.decision line (0211), without any address nor internal comment. */
export type BrevoProfileDecisionReader = (
  line: ClaimedLine,
) => Promise<BrevoProfileDecision | null>;

/**
 * The live brand profile of a contact line (0212; 06 RG79): read only for an advertiser, in its own
 * short transaction; null when the account holds no brand profile.
 */
export type BrandProfileReader = (
  line: ClaimedLine,
) => Promise<BrandProfileAttributes | null>;

/** The decision of a creator_profile.decision line (0245), without any address nor internal comment. */
export type BrevoCreatorProfileDecisionReader = (
  line: ClaimedLine,
) => Promise<BrevoCreatorProfileDecision | null>;

/** The decision of a portfolio.decision line (0245), without any address, caption nor file. */
export type BrevoPortfolioDecisionReader = (
  line: ClaimedLine,
) => Promise<BrevoPortfolioDecision | null>;

/**
 * The live storefront of a creator contact line (0245; 07 RG107): read only for a creator, in its
 * own short transaction; null when the account holds none.
 */
export type CreatorProfileReader = (
  line: ClaimedLine,
) => Promise<CreatorProfileAttributes | null>;

/**
 * The facts of a verification e-mail line (0227): the request, its reason or badge date, the line's
 * code and the account's language; never the code, a handle nor a figure.
 */
export type BrevoVerificationEmailReader = (
  line: ClaimedLine,
) => Promise<BrevoVerificationEmail | null>;

/**
 * The facts of an e-mail of the life of the badge (0236): the object the line names (a badge, a
 * request, a dispute, a review), its level, reason and dates, and the account's language; never a
 * figure, a handle, the creator's text nor the agent.
 */
export type BrevoBadgeEmailReader = (
  line: ClaimedLine,
) => Promise<BrevoBadgeEmail | null>;

/** The level of the badges an account holds and its date (0227): a contact line of Brevo only. */
export type VerifiedBadgeReader = (
  line: ClaimedLine,
) => Promise<VerifiedBadge | null>;

export type BrevoErasureSubjectReader = (
  line: ClaimedLine,
) => Promise<BrevoErasureSubject | null>;

/** The address, language and time of an executed erasure whose answer is to leave (0150). */
export type ErasureNotificationSubjectReader = (
  requestId: string,
) => Promise<ErasureNotificationSubject | null>;

export type BrevoConnectorDependencies = {
  /** Reads the subject of a line in processing for this worker (0112), its own transaction. */
  readSubject: BrevoSubjectReader;
  /** Reads the held address of an executed erasure (0150, E-5 pool), its own transaction. */
  readErasureNotificationSubject: ErasureNotificationSubjectReader;
  /** Reads the decision of a profile.decision line (0211), its own transaction. */
  readProfileDecision: BrevoProfileDecisionReader;
  /** Reads the decision of a creator_profile.decision line (0245), its own transaction. */
  readCreatorProfileDecision: BrevoCreatorProfileDecisionReader;
  /** Reads the decision of a portfolio.decision line (0245), its own transaction. */
  readPortfolioDecision: BrevoPortfolioDecisionReader;
  /** Reads the live storefront of a creator contact line (0245), its own transaction. */
  readCreatorProfile: CreatorProfileReader;
  /** Reads the facts of a verification e-mail line (0227), its own transaction. */
  readVerificationEmail: BrevoVerificationEmailReader;
  /** Reads the facts of an e-mail of the life of the badge (0236), its own transaction. */
  readBadgeEmail: BrevoBadgeEmailReader;
  /** Reads the badge level of the account of a contact line (0227), its own transaction. */
  readVerifiedBadge: VerifiedBadgeReader;
  /** Reads the contact of an erased account on an account.deleted line (0136), its own transaction. */
  readErasureSubject: BrevoErasureSubjectReader;
  /** Reads the live brand profile of a contact line (0212), its own transaction. */
  readBrandProfile: BrandProfileReader;
  logger: BrevoClientLogger;
  fetch?: typeof fetch;
  timeoutMs?: number;
  /** The mapping of 16 §M4; replaced by the tests of the output check only. */
  mapContact?: typeof mapContact;
};

function domainOf(email: string): string {
  return email.slice(email.lastIndexOf("@") + 1).toLowerCase();
}

export function createBrevoConnectors(
  settings: BrevoConnectorSettings,
  dependencies: BrevoConnectorDependencies,
): { contact: Connector; transactional: Connector } {
  const hasCredentials =
    settings.mode !== "disabled" && settings.apiKey !== null;
  const testRecipients = new Set(
    settings.testRecipients.map((address) => address.toLowerCase()),
  );
  const map = dependencies.mapContact ?? mapContact;

  function client(destination: string): BrevoClient | null {
    if (settings.apiKey === null) {
      return null;
    }
    return createBrevoClient(
      { apiKey: settings.apiKey, baseUrl: settings.baseUrl, destination },
      {
        logger: dependencies.logger,
        ...(dependencies.fetch === undefined
          ? {}
          : { fetch: dependencies.fetch }),
        ...(dependencies.timeoutMs === undefined
          ? {}
          : { timeoutMs: dependencies.timeoutMs }),
      },
    );
  }
  const contactClient = client("brevo_contact");
  const transactionalClient = client("brevo_transactional");

  /** Step 6: in redirect, only a listed address is reached (16 RG117). */
  function redirected(email: string): boolean {
    return (
      settings.mode === "redirect" && !testRecipients.has(email.toLowerCase())
    );
  }

  /**
   * The call, refused again if the output check refused or a setting is missing (defence in depth:
   * the drain fails such a line before any call).
   */
  function guarded(
    description: CallDescription,
    call: (brevo: BrevoClient) => ReturnType<BrevoClient["upsertContact"]>,
    brevo: BrevoClient | null,
  ) {
    return () => {
      if (description.rejectedAttributeNames.length > 0) {
        return Promise.resolve({
          kind: "failed" as const,
          errorCode: "output_check_rejected",
        });
      }
      const missing = configurationFailureCode(description.missingSettings);
      if (missing !== null) {
        return Promise.resolve({ kind: "failed" as const, errorCode: missing });
      }
      if (brevo === null) {
        // Unreachable: the drain skips a connector without credentials before any call.
        throw new Error("no Brevo key for the worker");
      }
      return call(brevo);
    };
  }

  /** Operations 2 then 7 on the address, the call of a withdrawn or suppressed contact. */
  function unsubscribing(email: string): Preparation {
    const body = { emailBlacklisted: true };
    const rejected = Object.keys(body)
      .filter((name) => !UNSUBSCRIBE_BODY_FIELDS.has(name))
      .sort();
    if (rejected.length === 0 && redirected(email)) {
      return { kind: "skip", reason: "skipped_non_production" };
    }
    const description: CallDescription = {
      operation: "unsubscribe_contact",
      templateCode: null,
      attributeNames: [],
      rejectedAttributeNames: rejected,
      missingSettings: [],
    };
    return {
      kind: "mapped",
      description,
      recipientDomain: domainOf(email),
      send: guarded(
        description,
        (brevo) =>
          brevo.unsubscribeContact(email, body, settings.suppressionListId),
        contactClient,
      ),
    };
  }

  /**
   * account.deleted (04 §9.2, 15 RG79): operation 2, the contact deleted. Only on an erased account
   * (the request of the line, of its account, read by 0137); by its Brevo id when known, THEN by the
   * address held until Brevo confirms (a stale id never closes the request while a contact remains,
   * security review F5). Once the request is closed (the address released), a replay has nothing
   * left to delete.
   */
  async function deleting(
    line: ClaimedLine,
    account: AttemptState["account"],
  ): Promise<Preparation> {
    if (account === null || account.status !== "deleted") {
      // An account.deleted line on an account that is not erased: never deleted, visible.
      return { kind: "fail", errorCode: "account_not_erased" };
    }
    const subject = await dependencies.readErasureSubject(line);
    if (subject === null) {
      return { kind: "fail", errorCode: "erasure_not_found" };
    }
    const email = subject.email;
    if (email === null) {
      return { kind: "skip", reason: "erasure_closed" };
    }
    if (redirected(email)) {
      return { kind: "skip", reason: "skipped_non_production" };
    }
    const identifiers: BrevoContactIdentifier[] =
      subject.externalContactId === null
        ? [{ type: "email_id", value: email }]
        : [
            { type: "contact_id", value: subject.externalContactId },
            { type: "email_id", value: email },
          ];
    const description: CallDescription = {
      operation: "delete_contact",
      templateCode: null,
      attributeNames: [],
      rejectedAttributeNames: [],
      missingSettings: [],
    };
    return {
      kind: "mapped",
      description,
      recipientDomain: domainOf(email),
      send: guarded(
        description,
        (brevo) => brevo.deleteContact(identifiers),
        contactClient,
      ),
    };
  }

  /** email.changed (05 RG58, decision 5 of J7): the known contact moved to the new address. */
  async function changingEmail(
    line: ClaimedLine,
    account: NonNullable<AttemptState["account"]>,
  ): Promise<Preparation> {
    const subject = await dependencies.readSubject(line);
    if (subject === null) {
      return { kind: "skip", reason: "account_absent" };
    }
    const previousEmail = subject.previousEmail;
    if (previousEmail === null) {
      // No completed request behind the line: nothing to move from, visible, never guessed.
      return { kind: "fail", errorCode: "email_change_not_found" };
    }
    const body = { attributes: { EMAIL: subject.email } };
    const rejected = checkEmailChangeOutput(body);
    if (
      rejected.length === 0 &&
      (redirected(subject.email) || redirected(previousEmail))
    ) {
      return { kind: "skip", reason: "skipped_non_production" };
    }
    const identifier: BrevoContactIdentifier =
      subject.externalContactId === null
        ? { type: "email_id", value: previousEmail }
        : { type: "contact_id", value: subject.externalContactId };
    const withdrawn = !account.marketingEmailConsent || subject.suppressed;
    const description: CallDescription = {
      operation: "change_contact_email",
      templateCode: null,
      attributeNames: Object.keys(body.attributes),
      rejectedAttributeNames: rejected,
      missingSettings: [],
    };
    return {
      kind: "mapped",
      description,
      recipientDomain: domainOf(subject.email),
      send: guarded(
        description,
        async (brevo) => {
          const changed = await brevo.updateContactEmail(identifier, body);
          if (changed.kind !== "succeeded" || !withdrawn) {
            return changed;
          }
          // Brevo lifts the blacklist with the address: operations 2 and 7 again (decision 5).
          return brevo.unsubscribeContact(
            subject.email,
            { emailBlacklisted: true },
            settings.suppressionListId,
          );
        },
        contactClient,
      ),
    };
  }

  /** Operation 6 of an e-mail written by INFLUX: its text checked (RG158), then redirect (RG117). */
  function rendered(
    line: ClaimedLine,
    code: RenderedEmailCode,
    recipient: string,
    email: RenderedEmail,
    locale: ReturnType<typeof languageOf>,
  ): Preparation {
    const body = {
      sender: { name: SENDER_NAME, email: settings.senderTransactional },
      to: [{ email: recipient }],
      subject: email.subject,
      htmlContent: email.html,
      textContent: email.text,
      tags: [code],
    };
    const rejected = checkRenderedTransactionalOutput(body);
    if (rejected.length === 0 && redirected(recipient)) {
      return { kind: "skip", reason: "skipped_non_production" };
    }
    const description: CallDescription = {
      operation: "send_transactional",
      templateCode: code,
      attributeNames: [],
      rejectedAttributeNames: rejected,
      missingSettings: [],
    };
    return {
      kind: "mapped",
      description,
      recipientDomain: domainOf(recipient),
      send: guarded(
        description,
        (brevo) => brevo.sendTransactional(body, line.idempotencyKey, locale),
        transactionalClient,
      ),
    };
  }

  /** The welcome e-mail of the code's role (05 RG86), once per account (RG76, 16 RG90). */
  function welcome(role: "advertiser" | "creator") {
    return (
      line: ClaimedLine,
      account: NonNullable<AttemptState["account"]>,
      subject: BrevoSubject,
    ): Preparation => {
      if (subject.welcomeSent) {
        // 05 RG76, CA41; 16 RG90: the local belt, the one we count on.
        return { kind: "skip", reason: "already_sent" };
      }
      const locale = languageOf(account);
      const email = renderWelcomeEmail({ locale, role });
      return rendered(
        line,
        role === "advertiser"
          ? "account.welcome_advertiser"
          : "account.welcome_creator",
        subject.email,
        email,
        locale,
      );
    };
  }

  /** auth.email_changed_notice (05 RG58): the side the line names, never the address (RG74). */
  function emailChangedNotice(
    line: ClaimedLine,
    account: NonNullable<AttemptState["account"]>,
    subject: BrevoSubject,
  ): Preparation {
    const side = line.payload.recipient;
    let recipient = subject.email;
    if (side === "previous") {
      if (subject.previousEmail === null) {
        // No completed request behind the line: nothing to tell, visible, never guessed.
        return { kind: "fail", errorCode: "email_change_not_found" };
      }
      recipient = subject.previousEmail;
    } else if (side !== "current") {
      return { kind: "fail", errorCode: "notice_recipient_unknown" };
    }
    const locale = languageOf(account);
    const email = renderEmailChangedNoticeEmail({ locale, side });
    return rendered(
      line,
      "auth.email_changed_notice",
      recipient,
      email,
      locale,
    );
  }

  /** auth.new_device (05 RG142, 16 RG157): the text of INFLUX, the session read at consumption. */
  function newDevice(
    line: ClaimedLine,
    account: NonNullable<AttemptState["account"]>,
    subject: BrevoSubject,
  ): Preparation {
    if (subject.signedInAt === null) {
      // No session of this account behind the line: nothing to tell, visible, never guessed.
      return { kind: "fail", errorCode: "session_not_found" };
    }
    const summary = userAgentSummarySchema.safeParse(subject.browser);
    const locale = languageOf(account);
    const email = renderNewDeviceEmail({
      locale,
      signedInAt: new Date(subject.signedInAt),
      timeZone: subject.timeZone,
      // a summary outside the closed list is never quoted (05 Q14 point 5)
      browser: summary.success ? summary.data : UNIDENTIFIED_USER_AGENT,
    });
    return rendered(line, "auth.new_device", subject.email, email, locale);
  }

  /** privacy.request_received (16 RG160): the text of INFLUX, the request read at consumption. */
  function dataRequestReceived(
    line: ClaimedLine,
    account: NonNullable<AttemptState["account"]>,
    subject: BrevoSubject,
  ): Preparation {
    const request = subject.dataRequest;
    if (request === null) {
      // No request of this account behind the line: nothing to acknowledge, visible, never guessed.
      return { kind: "fail", errorCode: "request_not_found" };
    }
    if (request.type !== "access") {
      // RG160 (export only since D72): no generic text for another type, an erasure included, which
      // is answered by privacy.erasure_completed.
      return { kind: "fail", errorCode: "unsupported_request_type" };
    }
    if (request.closed) {
      // RG160: a request already handled is never announced as to be handled.
      return { kind: "skip", reason: "request_closed" };
    }
    const locale = languageOf(account);
    const email = renderDataRequestReceivedEmail({
      locale,
      type: request.type,
      receivedAt: new Date(request.receivedAt),
      dueAt: new Date(request.dueAt),
      timeZone: subject.timeZone,
    });
    return rendered(
      line,
      "privacy.request_received",
      subject.email,
      email,
      locale,
    );
  }

  /** privacy.export_ready (J8 commit 8): where and until when, the export read at consumption. */
  function exportReady(
    line: ClaimedLine,
    account: NonNullable<AttemptState["account"]>,
    subject: BrevoSubject,
  ): Preparation {
    if (subject.dataRequest === null || subject.exportExpiresAt === null) {
      // No export of this account behind the line: nothing to announce, visible, never guessed.
      return { kind: "fail", errorCode: "export_not_found" };
    }
    if (subject.dataRequest.closed) {
      return { kind: "skip", reason: "request_closed" };
    }
    const locale = languageOf(account);
    const email = renderExportReadyEmail({
      locale,
      expiresAt: new Date(subject.exportExpiresAt),
      timeZone: subject.timeZone,
    });
    return rendered(line, "privacy.export_ready", subject.email, email, locale);
  }

  /**
   * profile.decision (06 RG66, RG69; L2C commit 09): the answer to the examination of a brand
   * profile. The address and the account checks come from the subject (as every e-mail of an active
   * account); the decision, its reason, the agent's message and the language from the decision read
   * at consumption (0211), never from the payload. One decision, one e-mail: the idempotency key
   * is the entry's. A reason outside the closed list, or `other` without its message, is a visible
   * failure, never guessed.
   */
  async function profileDecision(
    line: ClaimedLine,
    _account: NonNullable<AttemptState["account"]>,
    subject: BrevoSubject,
  ): Promise<Preparation> {
    const read = await dependencies.readProfileDecision(line);
    if (read === null) {
      // No decided entry of this account behind the line: nothing to announce, visible.
      return { kind: "fail", errorCode: "decision_not_found" };
    }
    const locale = read.preferredLanguage === "fr" ? "fr" : "en";
    if (read.decision === "published") {
      return rendered(
        line,
        "profile.decision",
        subject.email,
        renderBrandDecisionEmail({ locale, decision: "published" }),
        locale,
      );
    }
    if (read.decision !== "rejected") {
      return { kind: "fail", errorCode: "decision_unknown" };
    }
    const reason =
      read.reasonCode === null ? null : rejectionReasonOf(read.reasonCode);
    if (reason === null) {
      return { kind: "fail", errorCode: "rejection_reason_unknown" };
    }
    if (reason === "other" && read.memberMessage === null) {
      return { kind: "fail", errorCode: "member_message_missing" };
    }
    return rendered(
      line,
      "profile.decision",
      subject.email,
      renderBrandDecisionEmail({
        locale,
        decision: "rejected",
        reason,
        memberMessage: read.memberMessage,
      }),
      locale,
    );
  }

  /**
   * creator_profile.decision (07 RG96, RG99; L2G commit 10): the answer to the examination of a
   * creator profile. The address and the account checks come from the subject; the kind of the
   * entry, the decision, its reason, the agent's message and the language from the decision read at
   * consumption (0245), never from the payload. One decision, one e-mail: the idempotency key is
   * the entry's. A kind, decision or reason outside the closed lists, or `other` without its
   * message, is a visible failure, never guessed.
   */
  async function creatorProfileDecision(
    line: ClaimedLine,
    _account: NonNullable<AttemptState["account"]>,
    subject: BrevoSubject,
  ): Promise<Preparation> {
    const read = await dependencies.readCreatorProfileDecision(line);
    if (read === null) {
      // No decided entry of this account behind the line: nothing to announce, visible.
      return { kind: "fail", errorCode: "decision_not_found" };
    }
    const locale = read.preferredLanguage === "fr" ? "fr" : "en";
    if (read.kind !== "submission" && read.kind !== "revision") {
      return { kind: "fail", errorCode: "entry_kind_unknown" };
    }
    const kind = read.kind;
    if (read.decision === "published") {
      return rendered(
        line,
        "creator_profile.decision",
        subject.email,
        renderCreatorProfileDecisionEmail({
          locale,
          kind,
          decision: "published",
        }),
        locale,
      );
    }
    if (read.decision !== "rejected") {
      return { kind: "fail", errorCode: "decision_unknown" };
    }
    const reason =
      read.reasonCode === null
        ? null
        : creatorRejectionReasonOf(read.reasonCode);
    if (reason === null) {
      return { kind: "fail", errorCode: "rejection_reason_unknown" };
    }
    if (reason === "other" && read.memberMessage === null) {
      return { kind: "fail", errorCode: "member_message_missing" };
    }
    return rendered(
      line,
      "creator_profile.decision",
      subject.email,
      renderCreatorProfileDecisionEmail({
        locale,
        kind,
        decision: "rejected",
        reason,
        memberMessage: read.memberMessage,
      }),
      locale,
    );
  }

  /**
   * portfolio.decision (07 RG78, RG79, RG99; L2G commit 10): the answer to the moderation of one
   * visual. The decision, its reason of the grid of RG79, whether it replaces another visual, the
   * day of its deposit and the language come from the read at consumption (0245), never from the
   * payload. One decision, one e-mail: the key is the visual's. A decision or reason outside the
   * closed lists is a visible failure, never guessed.
   */
  async function portfolioDecision(
    line: ClaimedLine,
    _account: NonNullable<AttemptState["account"]>,
    subject: BrevoSubject,
  ): Promise<Preparation> {
    const read = await dependencies.readPortfolioDecision(line);
    if (read === null) {
      // No decided visual of this account behind the line: nothing to announce, visible.
      return { kind: "fail", errorCode: "decision_not_found" };
    }
    const locale = read.preferredLanguage === "fr" ? "fr" : "en";
    if (read.decision === "approved") {
      return rendered(
        line,
        "portfolio.decision",
        subject.email,
        renderPortfolioDecisionEmail({
          locale,
          decision: "approved",
          replacement: read.replacement,
          depositedOn: read.depositedOn,
        }),
        locale,
      );
    }
    if (read.decision !== "rejected") {
      return { kind: "fail", errorCode: "decision_unknown" };
    }
    const reason =
      read.reasonCode === null
        ? null
        : portfolioRejectionReasonOf(read.reasonCode);
    if (reason === null) {
      return { kind: "fail", errorCode: "rejection_reason_unknown" };
    }
    return rendered(
      line,
      "portfolio.decision",
      subject.email,
      renderPortfolioDecisionEmail({
        locale,
        decision: "rejected",
        reason,
        replacement: read.replacement,
        depositedOn: read.depositedOn,
      }),
      locale,
    );
  }

  /**
   * The five e-mails of the verification (08 RG94, EC-L2E-3). The address and the account checks
   * come from the subject; the level, network line, reason, badge date, code and language from the
   * facts read at consumption (0227), never from the payload. A refusal speaks with the text of its
   * reason (modele §5), the agent's own text only for the two reasons that require one.
   */
  function verificationEmail(code: RenderedEmailCode) {
    return async (
      line: ClaimedLine,
      _account: NonNullable<AttemptState["account"]>,
      subject: BrevoSubject,
    ): Promise<Preparation> => {
      const read = await dependencies.readVerificationEmail(line);
      if (read === null) {
        // No such request of this account behind the line: nothing to announce, visible.
        return { kind: "fail", errorCode: "verification_not_found" };
      }
      const locale = read.preferredLanguage === "fr" ? "fr" : "en";
      const level = verificationLevelOf(read.level);
      if (level === null) {
        return { kind: "fail", errorCode: "verification_level_unknown" };
      }
      const networkName =
        level === "brand_verified"
          ? null
          : verificationNetworkOf(locale, read.networkCode);
      if (level !== "brand_verified" && networkName === null) {
        return { kind: "fail", errorCode: "network_unknown" };
      }
      const common = {
        locale,
        timeZone: subject.timeZone,
        level,
        networkName,
      } as const;
      const send = (email: RenderedEmail) =>
        rendered(line, code, subject.email, email, locale);

      if (code === "verification.received") {
        if (
          !["pending", "approved", "rejected", "closed"].includes(
            read.requestStatus,
          )
        ) {
          // cancelled before the e-mail left: never announced
          return { kind: "skip", reason: "request_closed" };
        }
        return send(renderVerificationEmail({ ...common, kind: "received" }));
      }
      if (code === "verification.code_issued") {
        if (
          (read.codeKind !== "network" && read.codeKind !== "domain") ||
          read.codeExpiresAt === null
        ) {
          return { kind: "fail", errorCode: "code_not_found" };
        }
        const expiresAt = new Date(read.codeExpiresAt);
        if (
          read.codeRevoked ||
          !["draft", "pending"].includes(read.requestStatus) ||
          expiresAt.getTime() <= Date.now()
        ) {
          // a newer code, a request closed or a date past: the e-mail would mislead, never sent
          return { kind: "skip", reason: "code_obsolete" };
        }
        return send(
          renderVerificationEmail({
            ...common,
            kind: "code_issued",
            codeKind: read.codeKind,
            expiresAt,
          }),
        );
      }
      if (code === "verification.request_expired") {
        if (read.requestStatus !== "expired") {
          return { kind: "fail", errorCode: "request_not_expired" };
        }
        return send(renderVerificationEmail({ ...common, kind: "expired" }));
      }
      // verification.decision
      if (read.requestStatus === "approved") {
        if (read.grantedAt === null) {
          return { kind: "fail", errorCode: "badge_not_found" };
        }
        return send(
          renderVerificationEmail({
            ...common,
            kind: "granted",
            grantedAt: new Date(read.grantedAt),
            expiresAt:
              read.badgeExpiresAt === null
                ? null
                : new Date(read.badgeExpiresAt),
          }),
        );
      }
      if (
        read.requestStatus !== "rejected" &&
        read.requestStatus !== "closed"
      ) {
        return { kind: "fail", errorCode: "decision_unknown" };
      }
      const reason =
        read.reasonCode === null
          ? null
          : verificationReasonOf(level, read.reasonCode);
      if (reason === null) {
        return { kind: "fail", errorCode: "rejection_reason_unknown" };
      }
      const needsMessage =
        reason.code === "other" || reason.code === "terms_breach";
      if (needsMessage && read.memberMessage === null) {
        return { kind: "fail", errorCode: "member_message_missing" };
      }
      return send(
        renderVerificationEmail({
          ...common,
          kind: "rejected",
          reason,
          memberMessage: needsMessage ? read.memberMessage : null,
          // a creator's refusal can be appealed; a closed request and a brand's refusal cannot
          disputeWindowDays:
            level !== "brand_verified" && read.requestStatus === "rejected"
              ? read.disputeWindowDays
              : null,
        }),
      );
    };
  }

  /**
   * The eight e-mails of the life of the badge (08 RG94; modele §4 "Outbox"). The address and the
   * account checks come from the subject; the level, network, state, reason and dates from the facts
   * read at consumption (0236), never from the payload. What would mislead if sent now (the object
   * changed since the line was queued) is skipped.
   */
  function badgeEmail(code: RenderedEmailCode) {
    return async (
      line: ClaimedLine,
      _account: NonNullable<AttemptState["account"]>,
      subject: BrevoSubject,
    ): Promise<Preparation> => {
      const read = await dependencies.readBadgeEmail(line);
      if (read === null) {
        // No such object of this account behind the line: nothing to announce, visible.
        return { kind: "fail", errorCode: "badge_notice_not_found" };
      }
      const locale = read.preferredLanguage === "fr" ? "fr" : "en";
      const level = verificationLevelOf(read.level);
      if (level === null) {
        return { kind: "fail", errorCode: "verification_level_unknown" };
      }
      const networkName =
        level === "brand_verified"
          ? null
          : verificationNetworkOf(locale, read.networkCode);
      if (level !== "brand_verified" && networkName === null) {
        return { kind: "fail", errorCode: "network_unknown" };
      }
      const common = {
        locale,
        timeZone: subject.timeZone,
        level,
        networkName,
      } as const;
      const send = (input: BadgeNoticeInput) =>
        rendered(
          line,
          code,
          subject.email,
          renderBadgeNoticeEmail(input),
          locale,
        );
      const date = (iso: string | null) =>
        iso === null ? null : new Date(iso);

      if (
        code === "verification.expiry_reminder" ||
        code === "verification.expiry_to_refresh" ||
        code === "verification.expiry_removed"
      ) {
        // only an audience badge and a brand badge expire (RG30, RG71)
        if (level === "account_verified") {
          return { kind: "fail", errorCode: "badge_level_unexpected" };
        }
        const expected =
          code === "verification.expiry_reminder"
            ? ["active"]
            : code === "verification.expiry_to_refresh"
              ? ["to_refresh", "to_reconfirm"]
              : ["expired"];
        if (!expected.includes(read.objectState)) {
          // replaced, refreshed or ended since: the e-mail would mislead, never sent
          return { kind: "skip", reason: "badge_changed" };
        }
        if (code === "verification.expiry_removed") {
          return send({ ...common, kind: "expiry_removed" });
        }
        if (code === "verification.expiry_reminder") {
          const expiresAt = date(read.badgeExpiresAt);
          return expiresAt === null
            ? { kind: "fail", errorCode: "badge_dates_missing" }
            : send({ ...common, kind: "expiry_reminder", expiresAt });
        }
        const graceEndsAt = date(read.graceEndsAt);
        return graceEndsAt === null
          ? { kind: "fail", errorCode: "badge_dates_missing" }
          : send({ ...common, kind: "expiry_to_refresh", graceEndsAt });
      }

      if (code === "verification.revoked_notice") {
        if (read.objectState !== "revoked") {
          return { kind: "skip", reason: "badge_changed" };
        }
        const reason =
          read.reasonCode === null ? null : revocationReasonOf(read.reasonCode);
        if (reason === null) {
          return { kind: "fail", errorCode: "revocation_reason_unknown" };
        }
        if (reason === "terms_breach" && read.memberMessage === null) {
          return { kind: "fail", errorCode: "member_message_missing" };
        }
        return send({
          ...common,
          kind: "revoked",
          reason,
          memberMessage: read.memberMessage,
          disputeWindowDays:
            level === "brand_verified" ? null : read.disputeWindowDays,
        });
      }

      if (code === "verification.dispute_received") {
        return send({ ...common, kind: "dispute_received" });
      }

      if (code === "verification.dispute_outcome") {
        if (read.objectState === "withdrawn") {
          return { kind: "skip", reason: "dispute_withdrawn" };
        }
        const outcome =
          read.outcomeReasonCode === null
            ? null
            : disputeOutcomeOf(read.outcomeReasonCode);
        if (
          outcome === null ||
          (read.objectState === "upheld") !==
            (outcome !== "decision_overturned") ||
          (read.objectState !== "upheld" && read.objectState !== "overturned")
        ) {
          return { kind: "fail", errorCode: "dispute_outcome_unknown" };
        }
        if (outcome === "new_request_needed") {
          return send({
            ...common,
            kind: "dispute_outcome",
            outcome: { code: "new_request_needed" },
          });
        }
        if (outcome === "other") {
          return read.memberMessage === null
            ? { kind: "fail", errorCode: "member_message_missing" }
            : send({
                ...common,
                kind: "dispute_outcome",
                outcome: { code: "other", memberMessage: read.memberMessage },
              });
        }
        if (outcome === "decision_overturned") {
          const restoredAt = date(read.restoredAt);
          return restoredAt === null
            ? { kind: "fail", errorCode: "badge_dates_missing" }
            : send({
                ...common,
                kind: "dispute_outcome",
                outcome: { code: "decision_overturned", restoredAt },
              });
        }
        // decision_confirmed: the reason the decision stood on
        let contested: ContestedReason | null = null;
        if (read.reasonCode !== null) {
          if (read.contestedDecision === "revocation") {
            const reason = revocationReasonOf(read.reasonCode);
            contested =
              reason === null ? null : { decision: "revocation", code: reason };
          } else if (read.contestedDecision === "refusal") {
            const reason = verificationReasonOf(level, read.reasonCode);
            contested =
              reason === null || reason.population !== "creator"
                ? null
                : { decision: "refusal", code: reason.code };
          }
        }
        return contested === null
          ? { kind: "fail", errorCode: "rejection_reason_unknown" }
          : send({
              ...common,
              kind: "dispute_outcome",
              outcome: { code: "decision_confirmed", contested },
            });
      }

      if (code === "verification.reconfirm_required") {
        if (read.objectState !== "proof_required") {
          return { kind: "skip", reason: "review_changed" };
        }
        return send({ ...common, kind: "reconfirm_required" });
      }

      // verification.agent_opened_notice
      if (
        !["pending", "approved", "rejected", "closed"].includes(
          read.objectState,
        )
      ) {
        return { kind: "skip", reason: "request_closed" };
      }
      return send({ ...common, kind: "agent_opened_notice" });
    };
  }

  /**
   * privacy.erasure_completed (D72, 16 RG160 bis): the account is erased, so the address, language
   * and time zone come from the execution that holds them; nothing but the date is written.
   */
  async function erasureCompleted(line: ClaimedLine): Promise<Preparation> {
    const requestId = line.payload.request_id;
    if (typeof requestId !== "string") {
      return { kind: "fail", errorCode: "erasure_not_found" };
    }
    const subject =
      await dependencies.readErasureNotificationSubject(requestId);
    if (subject === null) {
      // No executed, open erasure with its address held: nothing to answer, visible, never guessed.
      return { kind: "fail", errorCode: "erasure_not_found" };
    }
    const locale = subject.preferredLanguage === "fr" ? "fr" : "en";
    const email = renderErasureCompletedEmail({
      locale,
      erasedAt: new Date(subject.erasedAt),
      timeZone: subject.timeZone,
    });
    return rendered(
      line,
      "privacy.erasure_completed",
      subject.email,
      email,
      locale,
    );
  }

  const RENDERERS: Readonly<
    Record<
      AccountEmailCode,
      (
        line: ClaimedLine,
        account: NonNullable<AttemptState["account"]>,
        subject: BrevoSubject,
      ) => Preparation | Promise<Preparation>
    >
  > = {
    "account.welcome_advertiser": welcome("advertiser"),
    "account.welcome_creator": welcome("creator"),
    "auth.email_changed_notice": emailChangedNotice,
    "auth.new_device": newDevice,
    "privacy.request_received": dataRequestReceived,
    "privacy.export_ready": exportReady,
    "profile.decision": profileDecision,
    "creator_profile.decision": creatorProfileDecision,
    "portfolio.decision": portfolioDecision,
    "verification.received": verificationEmail("verification.received"),
    "verification.code_issued": verificationEmail("verification.code_issued"),
    "verification.decision": verificationEmail("verification.decision"),
    "verification.request_expired": verificationEmail(
      "verification.request_expired",
    ),
    "verification.expiry_reminder": badgeEmail("verification.expiry_reminder"),
    "verification.expiry_to_refresh": badgeEmail(
      "verification.expiry_to_refresh",
    ),
    "verification.expiry_removed": badgeEmail("verification.expiry_removed"),
    "verification.revoked_notice": badgeEmail("verification.revoked_notice"),
    "verification.dispute_received": badgeEmail(
      "verification.dispute_received",
    ),
    "verification.dispute_outcome": badgeEmail("verification.dispute_outcome"),
    "verification.reconfirm_required": badgeEmail(
      "verification.reconfirm_required",
    ),
    "verification.agent_opened_notice": badgeEmail(
      "verification.agent_opened_notice",
    ),
  };

  const contact: Connector = {
    destination: "brevo_contact",
    hasCredentials,
    async prepare(line, state) {
      if (line.eventType === "account.deleted") {
        return deleting(line, state.account);
      }
      const skipped = accountSkip(state.account);
      if (skipped !== null || state.account === null) {
        return skipped ?? { kind: "skip", reason: "account_absent" };
      }
      const account = state.account;
      if (line.eventType === "email.changed") {
        return changingEmail(line, account);
      }
      const unsubscribe = !account.marketingEmailConsent;
      if (
        unsubscribe &&
        (line.eventType === "lead.created" ||
          line.eventType === "profile.completed")
      ) {
        // 05 RG80, CA39; 06 CA41: no consent, no marketing contact; a skip, never a failure, and
        // never counted as one (ignored, without consent). The first publication of a brand reads
        // no profile for a member who never agreed to marketing.
        return { kind: "skip", reason: "no_consent" };
      }
      const subject = await dependencies.readSubject(line);
      if (subject === null) {
        return { kind: "skip", reason: "account_absent" };
      }

      if (unsubscribe || subject.suppressed) {
        // Operation 2 (then 7): the consent withdrawn since the emission (05 RG37, RG78), or a
        // contact under suppression, whatever the consent (RG93, CA55). It needs no list: never
        // held back by a missing setting (05 RG160 point 5, CA84).
        return unsubscribing(subject.email);
      }

      // Operation 1: the contact, by the closed mapping (16 §M4) and the output check (RG137).
      // A consent given again from the space (consent.granted, still in force at consumption)
      // lifts the blacklist that operation 2 set: Brevo keeps it otherwise (J6T-3). Never on any
      // other event: a blacklist set by Brevo itself waits for its webhook (RG90).
      // The list of the role, read at consumption (EC-8): missing, it is named (05 RG164) and the
      // drain fails the line, an incident (RG160), never a skip.
      const role = account.role === "advertiser" ? "advertiser" : "creator";
      const listId = brevoListIdOf(state.settings, role);
      // 06 RG79: the live profile of a brand enriches the contact (profile.completed, lead.updated
      // and any other event that rewrites the contact); a creator has none (RG81: sent empty).
      const profile =
        role === "advertiser"
          ? await dependencies.readBrandProfile(line)
          : null;
      // 07 RG107 to RG110: the live storefront of a creator enriches the contact the same way; read
      // for a creator only, on this Brevo line only (the base refuses an Apollo line, RG109).
      const creator =
        role === "creator" ? await dependencies.readCreatorProfile(line) : null;
      // 0227, 08 RG92: the level of the badge and its date, read from the base at every rewrite of
      // the contact, never guessed from the event (a replayed lead.created must not erase a badge)
      const badge = await dependencies.readVerifiedBadge(line);
      const body =
        line.eventType === "consent.granted"
          ? {
              ...map(account, subject, listId, profile, badge, creator),
              emailBlacklisted: false,
            }
          : map(account, subject, listId, profile, badge, creator);
      const description: CallDescription = {
        operation: "upsert_contact",
        templateCode: null,
        attributeNames: Object.keys(body.attributes).sort(),
        rejectedAttributeNames: checkContactOutput(body),
        missingSettings: listId === null ? [brevoListPathOf(role)] : [],
      };
      if (
        description.rejectedAttributeNames.length === 0 &&
        description.missingSettings.length === 0 &&
        redirected(subject.email)
      ) {
        return { kind: "skip", reason: "skipped_non_production" };
      }
      return {
        kind: "mapped",
        description,
        recipientDomain: domainOf(subject.email),
        send: guarded(
          description,
          (brevo) => brevo.upsertContact(body),
          contactClient,
        ),
      };
    },
  };

  const transactional: Connector = {
    destination: "brevo_transactional",
    hasCredentials: hasCredentials && settings.senderTransactional !== null,
    async prepare(line, state) {
      if (line.payload.email_code === "privacy.erasure_completed") {
        // Before the account step: the account is erased by construction.
        return erasureCompleted(line);
      }
      const skipped = accountSkip(state.account);
      if (skipped !== null || state.account === null) {
        return skipped ?? { kind: "skip", reason: "account_absent" };
      }
      const account = state.account;
      const code = line.payload.email_code;
      if (
        typeof code !== "string" ||
        !(WORKER_RENDERED_EMAILS as readonly string[]).includes(code)
      ) {
        // Not a queue e-mail: failed, visible, replayable once supported.
        return { kind: "fail", errorCode: "template_not_supported" };
      }
      const subject = await dependencies.readSubject(line);
      if (subject === null) {
        return { kind: "skip", reason: "account_absent" };
      }
      return RENDERERS[code as AccountEmailCode](line, account, subject);
    },
  };

  return { contact, transactional };
}
