// The e-mails `creator_profile.decision` and `portfolio.decision`: the answer to the examination of a
// creator profile (queue 2) and to the moderation of one visual (queue 3) (docs/mvp/07 RG78, RG79,
// RG96, RG97, RG99; jalons/l2g/modele.md EC-L2G-8, textes.md). Queued P1 by the decisions of 0244
// (one decision = one e-mail, keys creator_profile.decision:<entry> and portfolio.decision:<item>)
// and written by the worker at consumption from INFLUX's translation files
// (src/locales/<language>/email.json, `creatorProfileDecision` and `portfolioDecision`), like
// profile.decision for a brand: no Brevo template (D69), no link nor domain in the text (RG158, the
// output check of the connector refuses any), no amount (D48, D78).
// What is never in them: a handle, a link, a figure, a caption, a file name (RG108, RG99). The
// reason is the message of its code (RG96, RG79); only the reason `other` of a profile carries a
// text written by the agent (20 to 500 characters): escaped, never formatted as a template. The
// internal comment and the agent are never read here (0245).
// The texts of two reasons say « arobase » / « at sign » where 07 writes the character itself: the
// output check refuses any `@` in an e-mail (RG158), so the character cannot be written (EC-L2G-10-1).
import type { UiLocale } from "@influx/contracts/auth";
import {
  PORTFOLIO_REJECTION_REASON_CODES,
  type PortfolioRejectionReasonCode,
} from "@influx/contracts/creator-portfolio";
import {
  CREATOR_REJECTION_NEXT_STEP_OF,
  type CreatorRejectionReasonCode,
} from "@influx/contracts/creator-profile";
import english from "../../../locales/en/email.json" with { type: "json" };
import french from "../../../locales/fr/email.json" with { type: "json" };
import {
  DEFAULT_EMAIL_TIME_ZONE,
  escapeHtml,
  format,
  type RenderedEmail,
} from "../../identity/login-code-email.ts";

type EmailMessages = typeof french;
type ProfileTexts = EmailMessages["email"]["creatorProfileDecision"];
type PortfolioTexts = EmailMessages["email"]["portfolioDecision"];

const MESSAGES: Readonly<Record<UiLocale, EmailMessages>> = {
  fr: french,
  en: english,
};

/**
 * Days a refused visual stays in the Storage before its purge (07 Q9 of the founder, D79 (8);
 * `retention_due_at`, 0242). The text of a refusal says it; a change here changes the base too.
 */
export const PORTFOLIO_REFUSED_RETENTION_DAYS = 30;

/** The reason of the closed list of RG96, or null for a code outside it (never guessed). */
export function creatorRejectionReasonOf(
  code: string,
): CreatorRejectionReasonCode | null {
  return Object.hasOwn(CREATOR_REJECTION_NEXT_STEP_OF, code)
    ? (code as CreatorRejectionReasonCode)
    : null;
}

/** The reason of the grid of RG79 (RG82, RG83), or null for a code outside it. */
export function portfolioRejectionReasonOf(
  code: string,
): PortfolioRejectionReasonCode | null {
  return (PORTFOLIO_REJECTION_REASON_CODES as readonly string[]).includes(code)
    ? (code as PortfolioRejectionReasonCode)
    : null;
}

/** The lines of a written message, blank ones dropped: one paragraph each. */
function linesOf(message: string): string[] {
  return message
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "");
}

function assemble(
  locale: UiLocale,
  section: { subject: string; preheader: string; title: string },
  paragraphs: readonly string[],
  why: string,
): RenderedEmail {
  const because = format(
    MESSAGES[locale].email.transactional.why,
    { reason: why },
    locale,
    DEFAULT_EMAIL_TIME_ZONE,
  );
  const text = [
    section.title,
    "",
    ...paragraphs.flatMap((paragraph) => [paragraph, ""]),
    because,
  ].join("\n");
  const html = [
    `<!doctype html><html lang="${locale}"><head><meta charset="utf-8">`,
    `<title>${escapeHtml(section.subject)}</title></head><body>`,
    `<div style="display:none">${escapeHtml(section.preheader)}</div>`,
    `<h1>${escapeHtml(section.title)}</h1>`,
    ...paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`),
    `<p>${escapeHtml(because)}</p>`,
    "</body></html>",
  ].join("");
  return { subject: section.subject, html, text };
}

export type CreatorProfileDecisionEmailInput =
  | {
      locale: UiLocale;
      /** `submission`: the first examination or a resubmission; `revision`: a change of a published profile. */
      kind: "submission" | "revision";
      decision: "published";
    }
  | {
      locale: UiLocale;
      kind: "submission" | "revision";
      decision: "rejected";
      reason: CreatorRejectionReasonCode;
      /** The text written by the agent: `other` only (07 RG96), never for another reason. */
      memberMessage: string | null;
    };

export function renderCreatorProfileDecisionEmail(
  input: CreatorProfileDecisionEmailInput,
): RenderedEmail {
  const { locale } = input;
  const texts: ProfileTexts = MESSAGES[locale].email.creatorProfileDecision;
  if (input.decision === "published") {
    if (input.kind === "revision") {
      return assemble(
        locale,
        texts.revisionApproved,
        [texts.revisionApproved.body],
        texts.revisionApproved.why,
      );
    }
    return assemble(
      locale,
      texts.published,
      [texts.published.body, texts.published.edit],
      texts.published.why,
    );
  }
  const section =
    input.kind === "revision" ? texts.revisionRejected : texts.rejected;
  const paragraphs: string[] = [section.body, texts.reason[input.reason]];
  if (input.reason === "other") {
    paragraphs.push(...linesOf(input.memberMessage ?? ""));
  }
  paragraphs.push(texts.nextStep[CREATOR_REJECTION_NEXT_STEP_OF[input.reason]]);
  return assemble(locale, section, paragraphs, section.why);
}

export type PortfolioDecisionEmailInput =
  | {
      locale: UiLocale;
      decision: "approved";
      /** The visual replaces another one (RG81): the previous one leaves the profile. */
      replacement: boolean;
      /** The day of the deposit in the account's time zone, `YYYY-MM-DD`. */
      depositedOn: string;
    }
  | {
      locale: UiLocale;
      decision: "rejected";
      reason: PortfolioRejectionReasonCode;
      replacement: boolean;
      depositedOn: string;
    };

/** A day (`YYYY-MM-DD`) written in the language of the text; a malformed day is a programming error. */
function dayOf(locale: UiLocale, depositedOn: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(depositedOn);
  if (match === null) {
    throw new Error("depositedOn is not a day");
  }
  const at = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
  );
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(at);
}

export function renderPortfolioDecisionEmail(
  input: PortfolioDecisionEmailInput,
): RenderedEmail {
  const { locale } = input;
  const texts: PortfolioTexts = MESSAGES[locale].email.portfolioDecision;
  const date = dayOf(locale, input.depositedOn);
  const timeZone = DEFAULT_EMAIL_TIME_ZONE;
  if (input.decision === "approved") {
    const paragraphs = [
      format(texts.approved.body, { date }, locale, timeZone),
    ];
    if (input.replacement) {
      paragraphs.push(texts.approved.replacement);
    }
    return assemble(locale, texts.approved, paragraphs, texts.why);
  }
  const paragraphs = [
    format(texts.rejected.body, { date }, locale, timeZone),
    texts.reason[input.reason],
  ];
  if (input.replacement) {
    paragraphs.push(texts.rejected.replacement);
  }
  paragraphs.push(
    format(
      texts.rejected.nextStep,
      { days: String(PORTFOLIO_REFUSED_RETENTION_DAYS) },
      locale,
      timeZone,
    ),
  );
  return assemble(locale, texts.rejected, paragraphs, texts.why);
}

/**
 * The text of a refusal of a creator profile as its owner receives it (07 RG96, textes.md §1), and the
 * step that follows: what the decision screen shows the agent BEFORE the decision, read from the same
 * translation files as the e-mail so that the preview cannot drift from the message. For `other`, the
 * message is the lead-in; the agent's own text follows it.
 */
export function creatorRejectionReasonPreview(
  locale: UiLocale,
  reason: CreatorRejectionReasonCode,
): {
  message: string;
  nextStep: "fix" | "contact";
  nextStepMessage: string;
} {
  const texts: ProfileTexts = MESSAGES[locale].email.creatorProfileDecision;
  const nextStep = CREATOR_REJECTION_NEXT_STEP_OF[reason];
  return {
    message: texts.reason[reason],
    nextStep,
    nextStepMessage: texts.nextStep[nextStep],
  };
}

/** The text of a refusal of a visual as its owner receives it (07 RG79, RG82, RG83, textes.md §2). */
export function portfolioRejectionReasonPreview(
  locale: UiLocale,
  reason: PortfolioRejectionReasonCode,
): string {
  const texts: PortfolioTexts = MESSAGES[locale].email.portfolioDecision;
  return texts.reason[reason];
}
