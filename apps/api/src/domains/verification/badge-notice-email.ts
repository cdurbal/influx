// The eight e-mails of the life of the badge (docs/mvp/08 RG93, RG94; jalons/l2f/modele.md §4 "Outbox",
// annex textes.md; EC-L2F-16): the reminder, « à rafraîchir » and expiry (creator audience, brand),
// the withdrawal with its reason, the appeal received and decided, the proof to reconfirm and the
// verification opened by an agent. Queued P1 by the database (0230 to 0234, ids and the e-mail code
// only) and written by the worker at consumption from INFLUX's translation files
// (src/locales/<language>/email.json, `badgeNotice`), like verification-email.ts: no Brevo template
// (D69), no link, no figure of an audience, no handle, no network account identifier, no agent's name
// (fiche invariants 11 and 12).
//   - the reason of a withdrawal is one of the closed list of modele §2 (key
//     `badgeNotice.revoked.reason.<code>`); `influx_error` carries the apologies of INFLUX and never
//     accuses the member; the message written by the agent (reasons that require one) follows,
//     escaped, never formatted as a template, and the output check of the connector refuses it when
//     it looks like a link;
//   - the outcome of an appeal says the original reason (upheld) or the date of the badge handed back
//     (overturned), the team's own message for `other` only;
//   - the creator is told how long an appeal stays open, from `dispute_window_days`.
import type { UiLocale } from "@influx/contracts/auth";
import english from "../../locales/en/email.json" with { type: "json" };
import french from "../../locales/fr/email.json" with { type: "json" };
import {
  DEFAULT_EMAIL_TIME_ZONE,
  format,
  type RenderedEmail,
} from "../identity/login-code-email.ts";
import {
  linesOf,
  renderParts,
  type Parts,
  type VerificationEmailLevel,
} from "./verification-email.ts";

type EmailMessages = typeof french;
type Notice = EmailMessages["email"]["badgeNotice"];
type Verification = EmailMessages["email"]["verificationNotice"];
type Decision = EmailMessages["email"]["verificationDecision"];

const MESSAGES: Readonly<Record<UiLocale, EmailMessages>> = {
  fr: french,
  en: english,
};

/** The closed list of the reasons of a withdrawal (`verification.revocation_reasons`, 0231). */
export type RevocationReasonCode = keyof Notice["revoked"]["reason"];
/** The closed list of the outcomes of an appeal (`verification.dispute_outcome_reasons`, 0232). */
export type DisputeOutcomeCode = keyof Notice["disputeOutcome"]["outcome"];

/** The reason of a withdrawal as the database names it, null for a code outside the list. */
export function revocationReasonOf(code: string): RevocationReasonCode | null {
  return Object.hasOwn(french.email.badgeNotice.revoked.reason, code)
    ? (code as RevocationReasonCode)
    : null;
}

/** The outcome of an appeal as the database names it, null for a code outside the list. */
export function disputeOutcomeOf(code: string): DisputeOutcomeCode | null {
  return Object.hasOwn(french.email.badgeNotice.disputeOutcome.outcome, code)
    ? (code as DisputeOutcomeCode)
    : null;
}

/** The reason an appeal contests: a refusal of a request, or the withdrawal of a badge. */
export type ContestedReason =
  | { decision: "refusal"; code: keyof Decision["reason"]["creator"] }
  | { decision: "revocation"; code: RevocationReasonCode };

type Common = {
  locale: UiLocale;
  /** The account's time zone (IANA), UTC by default. */
  timeZone?: string;
  level: VerificationEmailLevel;
  /** The network line; null for a brand. */
  networkName: string | null;
};

export type BadgeNoticeInput =
  | (Common & { kind: "expiry_reminder"; expiresAt: Date })
  | (Common & { kind: "expiry_to_refresh"; graceEndsAt: Date })
  | (Common & { kind: "expiry_removed" })
  | (Common & {
      kind: "revoked";
      reason: RevocationReasonCode;
      /** The text written by the agent (a reason that requires one), null otherwise. */
      memberMessage: string | null;
      /** The days an appeal stays open: a creator only, null for a brand. */
      disputeWindowDays: number | null;
    })
  | (Common & { kind: "dispute_received" })
  | (Common & {
      kind: "dispute_outcome";
      outcome:
        | {
            code: "decision_confirmed";
            /** The sentence of the reason the decision stood on. */
            contested: ContestedReason;
          }
        | { code: "new_request_needed" }
        | { code: "other"; memberMessage: string }
        | { code: "decision_overturned"; restoredAt: Date };
    })
  | (Common & { kind: "reconfirm_required" })
  | (Common & { kind: "agent_opened_notice" });

function partsOf(input: BadgeNoticeInput): Parts {
  const { locale, level } = input;
  const timeZone = input.timeZone ?? DEFAULT_EMAIL_TIME_ZONE;
  const messages = MESSAGES[locale];
  const notice: Notice = messages.email.badgeNotice;
  const verification: Verification = messages.email.verificationNotice;
  const population = level === "brand_verified" ? "brand" : "creator";
  if (level !== "brand_verified" && input.networkName === null) {
    // the badge named by an appeal and the line of a reconfirmation are a network's
    if (
      input.kind === "dispute_received" ||
      input.kind === "dispute_outcome" ||
      input.kind === "reconfirm_required" ||
      input.kind === "agent_opened_notice"
    ) {
      throw new Error("a creator badge e-mail names its network");
    }
  }
  const values = { network: input.networkName ?? "" };
  const f = (
    template: string,
    more: Readonly<Record<string, string | Date>> = {},
  ) => format(template, { ...values, ...more }, locale, timeZone);
  const badge = f(verification.badge[level]);
  const why = (reason: string) =>
    format(messages.email.transactional.why, { reason }, locale, timeZone);

  switch (input.kind) {
    case "expiry_reminder": {
      const text = notice.expiryReminder[population];
      const more = { expiresAt: input.expiresAt };
      return {
        subject: text.subject,
        preheader: f(text.preheader, more),
        title: text.subject,
        paragraphs: [f(text.body, more)],
        why: why(notice.expiryReminder.why),
      };
    }
    case "expiry_to_refresh": {
      const text = notice.expiryToRefresh[population];
      const more = { graceEndsAt: input.graceEndsAt };
      return {
        subject: text.subject,
        preheader: f(text.preheader, more),
        title: text.subject,
        paragraphs: [f(text.body, more)],
        why: why(notice.expiryToRefresh.why),
      };
    }
    case "expiry_removed": {
      const text = notice.expiryRemoved[population];
      return {
        subject: text.subject,
        preheader: f(text.preheader),
        title: text.subject,
        paragraphs: [f(text.body)],
        why: why(notice.expiryRemoved.why),
      };
    }
    case "revoked": {
      const paragraphs = [
        f(notice.revoked.body, { reason: notice.revoked.reason[input.reason] }),
      ];
      if (input.memberMessage !== null) {
        paragraphs.push(...linesOf(input.memberMessage));
      }
      const days = input.disputeWindowDays;
      if (population === "creator" && days !== null) {
        paragraphs.push(
          f(
            days === 1
              ? notice.revoked.disputeOpenOne
              : notice.revoked.disputeOpen,
            { days: String(days) },
          ),
        );
      }
      return {
        subject: notice.revoked.subject,
        preheader: notice.revoked.preheader,
        title: notice.revoked.subject,
        paragraphs,
        why: why(notice.revoked.why),
      };
    }
    case "dispute_received":
      return {
        subject: notice.disputeReceived.subject,
        preheader: f(notice.disputeReceived.preheader, { badge }),
        title: notice.disputeReceived.subject,
        paragraphs: [f(notice.disputeReceived.body, { badge })],
        why: why(notice.disputeReceived.why),
      };
    case "dispute_outcome": {
      const { outcome } = input;
      const sentences = notice.disputeOutcome.outcome;
      const paragraphs: string[] = [];
      if (outcome.code === "decision_confirmed") {
        const { contested } = outcome;
        const reason =
          contested.decision === "refusal"
            ? messages.email.verificationDecision.reason.creator[contested.code]
            : notice.revoked.reason[contested.code];
        paragraphs.push(f(sentences.decision_confirmed, { reason }));
      } else if (outcome.code === "new_request_needed") {
        paragraphs.push(sentences.new_request_needed);
      } else if (outcome.code === "other") {
        paragraphs.push(sentences.other, ...linesOf(outcome.memberMessage));
      } else {
        paragraphs.push(
          f(sentences.decision_overturned, {
            badge,
            restoredAt: outcome.restoredAt,
          }),
        );
      }
      return {
        subject: notice.disputeOutcome.subject,
        preheader: notice.disputeOutcome.preheader,
        title: notice.disputeOutcome.subject,
        paragraphs,
        why: why(notice.disputeOutcome.why),
      };
    }
    case "reconfirm_required":
      return {
        subject: notice.reconfirmRequired.subject,
        preheader: f(notice.reconfirmRequired.preheader),
        title: notice.reconfirmRequired.subject,
        paragraphs: [f(notice.reconfirmRequired.body)],
        why: why(notice.reconfirmRequired.why),
      };
    case "agent_opened_notice": {
      const text = notice.agentOpened[population];
      return {
        subject: notice.agentOpened.subject,
        preheader: f(text.preheader),
        title: notice.agentOpened.subject,
        paragraphs: [f(text.body)],
        why: why(notice.agentOpened.why),
      };
    }
  }
}

export function renderBadgeNoticeEmail(input: BadgeNoticeInput): RenderedEmail {
  return renderParts(input.locale, partsOf(input));
}
