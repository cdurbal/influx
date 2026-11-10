// The five e-mails of the verification (docs/mvp/08 RG93, RG94; jalons/l2e/modele.md §4 "Outbox",
// §5; EC-L2E-3): request received, code generated, badge granted, request refused (or closed),
// request expired. Queued P1 by the doors of 0222, the task of 0223 and the decisions of 0224
// (keys verification.<event>:<request or code>, payload ids and the e-mail code only) and written by
// the worker at consumption from INFLUX's translation files (src/locales/<language>/email.json,
// `verificationNotice` and `verificationDecision`), like profile.decision: no Brevo template (D69),
// no link nor domain in the text (RG158, the output check of the connector refuses any), no amount
// (D48, D78), no figure, no handle, no network account identifier (fiche invariant 14).
//   - the text of a refusal is the one of its REASON (08 RG57, 06 RG51/RG52, word for word, key
//     `verificationDecision.reason.<population>.<code>`, the `message_key` of the database); the
//     member_message of the database is empty for a typed reason, and only `other` and `terms_breach`
//     (the two reasons that require one) carry a text written by the agent: it is escaped, never
//     formatted as a template, and the output check of the connector refuses it when it looks like a
//     link. The internal comment of the agent is never read here (0224).
//   - a granted badge says WHAT (level, network), WHERE (source) and WHEN (date), never a figure;
//     the audience one carries the sentence of RG93 on the authenticity of followers.
//   - the creator is told RG29 (INFLUX never asks for a network password) at the two moments it
//     matters: the request received and the code generated. The code itself is never in an e-mail.
import type { UiLocale } from "@influx/contracts/auth";
import english from "../../locales/en/email.json" with { type: "json" };
import french from "../../locales/fr/email.json" with { type: "json" };
import {
  DEFAULT_EMAIL_TIME_ZONE,
  escapeHtml,
  format,
  type RenderedEmail,
} from "../identity/login-code-email.ts";

type EmailMessages = typeof french;
type Notice = EmailMessages["email"]["verificationNotice"];
type Decision = EmailMessages["email"]["verificationDecision"];

const MESSAGES: Readonly<Record<UiLocale, EmailMessages>> = {
  fr: french,
  en: english,
};

/** The three levels of a request (`verification.badge_level`, 0221). */
export type VerificationEmailLevel =
  "account_verified" | "audience_verified" | "brand_verified";

const LEVELS: ReadonlySet<string> = new Set([
  "account_verified",
  "audience_verified",
  "brand_verified",
]);

/** The level of a request as the database names it, null for anything else. */
export function verificationLevelOf(
  level: string,
): VerificationEmailLevel | null {
  return LEVELS.has(level) ? (level as VerificationEmailLevel) : null;
}

/** The two closed lists of refusal reasons, distinct by population (08 RG57; 06 RG51, RG52). */
export type CreatorReasonCode = keyof Decision["reason"]["creator"];
export type BrandReasonCode = keyof Decision["reason"]["brand"];
export type VerificationReason =
  | { population: "creator"; code: CreatorReasonCode }
  | { population: "brand"; code: BrandReasonCode };

type NextStep = keyof Decision["nextStep"];

/** What the reader of the refusal can do next (08 RG57, last column), by reason; null: nothing to add. */
const CREATOR_NEXT_STEP: Readonly<Record<CreatorReasonCode, NextStep>> = {
  missing_evidence: "redeposit",
  evidence_too_old: "redeposit",
  evidence_unreadable: "redeposit",
  evidence_wrong_source: "redeposit",
  evidence_too_wide: "redeposit",
  ownership_not_proven: "restartOwnership",
  account_not_public: "makePublic",
  ownership_prerequisite: "askOwnershipFirst",
  evidence_inconsistent: "contact",
  evidence_suspected_forgery: "contact",
  shared_account: "contact",
  agency_managed: "none",
  terms_breach: "contact",
  minor: "none",
  account_unavailable: "contact",
  other: "contact",
};

const BRAND_NEXT_STEP: Readonly<Record<BrandReasonCode, NextStep | null>> = {
  domain_code_not_found: "retryBrand",
  registration_not_found: "retryBrand",
  // the message itself says the badge can be requested again once a source is added
  registration_unverifiable_country: null,
  name_mismatch: "retryBrand",
  account_unavailable: "contact",
  other: "contact",
};

/** The reasons that carry the text written by the agent (`requires_member_message`, 0221). */
const REQUIRES_MEMBER_MESSAGE: ReadonlySet<string> = new Set([
  "other",
  "terms_breach",
]);

/**
 * The reason with its message of the translation files: null for a code outside the closed list of
 * its population (a creator reason never explains a brand refusal, and conversely).
 */
export function verificationReasonOf(
  level: VerificationEmailLevel,
  code: string,
): VerificationReason | null {
  if (level === "brand_verified") {
    return Object.hasOwn(BRAND_NEXT_STEP, code)
      ? { population: "brand", code: code as BrandReasonCode }
      : null;
  }
  return Object.hasOwn(CREATOR_NEXT_STEP, code)
    ? { population: "creator", code: code as CreatorReasonCode }
    : null;
}

/**
 * What the decision screen of an agent shows BEFORE a refusal (08 RG57; L2E-22): the sentence of the
 * reason as the member receives it, and what the member can do next (null: nothing to add), read from
 * the very files of the e-mail so that the preview cannot drift from the message. For `other` and
 * `terms_breach` the agent's own text follows the sentence. Null for a code outside the closed list of
 * its population.
 */
export function verificationReasonPreview(
  locale: UiLocale,
  level: VerificationEmailLevel,
  code: string,
): { message: string; nextStep: string | null } | null {
  const reason = verificationReasonOf(level, code);
  if (reason === null) {
    return null;
  }
  const decision: Decision = MESSAGES[locale].email.verificationDecision;
  const step: NextStep | null =
    reason.population === "brand"
      ? BRAND_NEXT_STEP[reason.code]
      : CREATOR_NEXT_STEP[reason.code];
  return {
    message:
      reason.population === "brand"
        ? decision.reason.brand[reason.code]
        : decision.reason.creator[reason.code],
    nextStep: step === null ? null : decision.nextStep[step],
  };
}

/** The name of a network line, null for a code the files do not know. */
export function verificationNetworkOf(
  locale: UiLocale,
  code: string | null,
): string | null {
  const names: Readonly<Record<string, string>> =
    MESSAGES[locale].email.verificationNotice.network;
  return code !== null && Object.hasOwn(names, code)
    ? (names[code] ?? null)
    : null;
}

type Common = {
  locale: UiLocale;
  /** The account's time zone (IANA), UTC by default. */
  timeZone?: string;
  level: VerificationEmailLevel;
  /** The network line; null for a brand. A creator level needs it: without it the text is refused. */
  networkName: string | null;
};

export type VerificationEmailInput =
  | (Common & { kind: "received" })
  | (Common & {
      kind: "code_issued";
      codeKind: "network" | "domain";
      expiresAt: Date;
    })
  | (Common & { kind: "granted"; grantedAt: Date; expiresAt: Date | null })
  | (Common & {
      kind: "rejected";
      reason: VerificationReason;
      /** The text written by the agent: `other` and `terms_breach` only, never for another reason. */
      memberMessage: string | null;
      /**
       * The days an appeal stays open (08 RG77, annex textes.md): a creator's refusal only, null
       * for a brand (it corrects and submits again, 06 l. 718) and for a closed request.
       */
      disputeWindowDays?: number | null;
    })
  | (Common & { kind: "expired" });

/** The lines of a written message, blank ones dropped: one paragraph each. */
export function linesOf(message: string): string[] {
  return message
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "");
}

/** What an e-mail of the life of the badge says, before it is laid out. */
export type Parts = {
  subject: string;
  preheader: string;
  title: string;
  paragraphs: string[];
  why: string;
};

function partsOf(input: VerificationEmailInput): Parts {
  const { locale, level } = input;
  if (level !== "brand_verified" && input.networkName === null) {
    throw new Error("a creator verification e-mail names its network");
  }
  const timeZone = input.timeZone ?? DEFAULT_EMAIL_TIME_ZONE;
  const messages = MESSAGES[locale];
  const notice: Notice = messages.email.verificationNotice;
  const decision: Decision = messages.email.verificationDecision;
  const values = { network: input.networkName ?? "" };
  const f = (
    template: string,
    more: Readonly<Record<string, string | Date>> = {},
  ) => format(template, { ...values, ...more }, locale, timeZone);
  const badge = f(notice.badge[level]);
  const why = (reason: string) =>
    format(messages.email.transactional.why, { reason }, locale, timeZone);

  switch (input.kind) {
    case "received":
      return {
        subject: notice.received.subject,
        preheader: notice.received.preheader,
        title: notice.received.title,
        paragraphs: [
          f(notice.received.body, { badge }),
          notice.received.pending,
          notice.neverAsk,
        ],
        why: why(notice.received.why),
      };
    case "code_issued": {
      const expiresAt = input.expiresAt;
      return {
        subject: notice.codeIssued.subject,
        preheader: f(notice.codeIssued.preheader, { expiresAt }),
        title: notice.codeIssued.title,
        paragraphs: [
          f(
            input.codeKind === "domain"
              ? notice.codeIssued.domain
              : notice.codeIssued.network,
          ),
          f(
            input.codeKind === "domain"
              ? notice.codeIssued.instructionsDomain
              : notice.codeIssued.instructionsNetwork,
          ),
          f(notice.codeIssued.validity, { expiresAt }),
          notice.neverAsk,
        ],
        why: why(notice.codeIssued.why),
      };
    }
    case "granted": {
      const grantedAt = input.grantedAt;
      const paragraphs = [
        f(decision.granted.body, { badge, grantedAt }),
        f(decision.granted.source[level]),
      ];
      if (input.expiresAt !== null) {
        paragraphs.push(
          f(decision.granted.validUntil, { expiresAt: input.expiresAt }),
        );
      }
      return {
        subject: decision.granted.subject,
        preheader: f(decision.granted.preheader, { badge, grantedAt }),
        title: decision.granted.title,
        paragraphs,
        why: why(decision.granted.why),
      };
    }
    case "rejected": {
      const { reason } = input;
      const text =
        reason.population === "brand"
          ? decision.reason.brand[reason.code]
          : decision.reason.creator[reason.code];
      const step: NextStep | null =
        reason.population === "brand"
          ? BRAND_NEXT_STEP[reason.code]
          : CREATOR_NEXT_STEP[reason.code];
      const paragraphs = [f(decision.rejected.body, { badge }), text];
      if (REQUIRES_MEMBER_MESSAGE.has(reason.code)) {
        paragraphs.push(...linesOf(input.memberMessage ?? ""));
      }
      if (step !== null) {
        paragraphs.push(decision.nextStep[step]);
      }
      const days = input.disputeWindowDays ?? null;
      if (days !== null) {
        paragraphs.push(
          f(
            days === 1
              ? decision.rejected.disputeOpenOne
              : decision.rejected.disputeOpen,
            { days: String(days) },
          ),
        );
      }
      return {
        subject: decision.rejected.subject,
        preheader: decision.rejected.preheader,
        title: decision.rejected.title,
        paragraphs,
        why: why(decision.rejected.why),
      };
    }
    case "expired":
      return {
        subject: notice.expired.subject,
        preheader: notice.expired.preheader,
        title: notice.expired.title,
        paragraphs: [f(notice.expired.body, { badge }), notice.expired.next],
        why: why(notice.expired.why),
      };
  }
}

/** Lays out the parts of an e-mail: a plain text and an HTML body, every value escaped. */
export function renderParts(locale: UiLocale, parts: Parts): RenderedEmail {
  const text = [
    parts.title,
    "",
    ...parts.paragraphs.flatMap((paragraph) => [paragraph, ""]),
    parts.why,
  ].join("\n");
  const html = [
    `<!doctype html><html lang="${locale}"><head><meta charset="utf-8">`,
    `<title>${escapeHtml(parts.subject)}</title></head><body>`,
    `<div style="display:none">${escapeHtml(parts.preheader)}</div>`,
    `<h1>${escapeHtml(parts.title)}</h1>`,
    ...parts.paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`),
    `<p>${escapeHtml(parts.why)}</p>`,
    "</body></html>",
  ].join("");
  return { subject: parts.subject, html, text };
}

export function renderVerificationEmail(
  input: VerificationEmailInput,
): RenderedEmail {
  return renderParts(input.locale, partsOf(input));
}
