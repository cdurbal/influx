// The e-mail `profile.decision`: the answer to the examination of a brand profile, published or
// refused (docs/mvp/06 RG66, RG69; 16 l. 794; jalons/l2c-fiche invariant 10; file.md A6). Queued P1
// by profiles.publish_advertiser_review_entry() and reject_advertiser_review_entry() (0210, 0211,
// one decision = one e-mail, key profile.decision:<entry>) and written by the worker at consumption
// from INFLUX's translation files (src/locales/<language>/email.json, `profileDecision`), like
// privacy.erasure_completed: no Brevo template (D69), no link nor domain in the text (RG158, the
// output check of the connector refuses any), no amount (D48, D78).
// The message of a refusal is the one of its reason (06 RG66, word for word, key
// `profileDecision.reason.<code>`). Only the reason `other` carries a text written by the agent
// (member_message, 20 to 500 characters): it is escaped, never formatted as a template, and the
// output check of the connector refuses it when it looks like a link. The internal comment of the
// agent is never read here (0211).
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
type Texts = EmailMessages["email"]["profileDecision"];

const MESSAGES: Readonly<Record<UiLocale, EmailMessages>> = {
  fr: french,
  en: english,
};

/** The closed list of refusal reasons (profiles.advertiser_rejection_reasons, 0207; 06 RG66). */
export type RejectionReasonCode = keyof Texts["reason"];

/** What the reader of the refusal can do next (06 RG66, third column), by reason. */
const NEXT_STEP: Readonly<
  Record<RejectionReasonCode, keyof Texts["nextStep"]>
> = {
  contact_in_public_field: "fix",
  presentation_insufficient: "fix",
  logo_non_compliant: "fix",
  sector_inconsistent: "fix",
  misleading_brand_name: "contact",
  illicit_content: "contact",
  duplicate_brand: "contact",
  other: "contact",
};

/** The reason with its message of the translation files, null for a code outside the closed list. */
export function rejectionReasonOf(code: string): RejectionReasonCode | null {
  return Object.hasOwn(NEXT_STEP, code) ? (code as RejectionReasonCode) : null;
}

export type BrandDecisionEmailInput =
  | { locale: UiLocale; decision: "published" }
  | {
      locale: UiLocale;
      decision: "rejected";
      reason: RejectionReasonCode;
      /** The text written by the agent: `other` only (06 RG66), never for another reason. */
      memberMessage: string | null;
    };

/** The lines of a written message, blank ones dropped: one paragraph each. */
function linesOf(message: string): string[] {
  return message
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "");
}

export function renderBrandDecisionEmail(
  input: BrandDecisionEmailInput,
): RenderedEmail {
  const { locale } = input;
  const messages = MESSAGES[locale];
  const texts = messages.email.profileDecision;
  const section = texts[input.decision];
  const why = format(
    messages.email.transactional.why,
    { reason: section.why },
    locale,
    DEFAULT_EMAIL_TIME_ZONE,
  );
  const paragraphs: string[] = [section.body];
  if (input.decision === "published") {
    paragraphs.push(texts.published.edit);
  } else {
    paragraphs.push(texts.reason[input.reason]);
    if (input.reason === "other") {
      paragraphs.push(...linesOf(input.memberMessage ?? ""));
    }
    paragraphs.push(texts.nextStep[NEXT_STEP[input.reason]]);
  }
  const text = [
    section.title,
    "",
    ...paragraphs.flatMap((paragraph) => [paragraph, ""]),
    why,
  ].join("\n");
  const html = [
    `<!doctype html><html lang="${locale}"><head><meta charset="utf-8">`,
    `<title>${escapeHtml(section.subject)}</title></head><body>`,
    `<div style="display:none">${escapeHtml(section.preheader)}</div>`,
    `<h1>${escapeHtml(section.title)}</h1>`,
    ...paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`),
    `<p>${escapeHtml(why)}</p>`,
    "</body></html>",
  ].join("");
  return { subject: section.subject, html, text };
}

/**
 * The text of a refusal reason as the brand receives it (06 RG66, word for word), and what the
 * brand can do next: what the decision screen shows the agent BEFORE the decision (file.md A6, 15
 * C6). Read from the same translation files as the e-mail, so that the preview cannot drift from
 * the message. For `other`, the message is the lead-in; the agent's own text follows it.
 */
export function rejectionReasonPreview(
  locale: UiLocale,
  reason: RejectionReasonCode,
): { message: string; nextStep: string } {
  const texts = MESSAGES[locale].email.profileDecision;
  return {
    message: texts.reason[reason],
    nextStep: texts.nextStep[NEXT_STEP[reason]],
  };
}
