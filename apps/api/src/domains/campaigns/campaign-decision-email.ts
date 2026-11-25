// The e-mail `campaign.decision`: the answer to a decision of INFLUX on a campaign, published or
// refused by queue 7, paused, resumed, closed or corrected by an agent, created for the brand, or
// closed by the system at the end of its period (docs/mvp/09 RG90, RG93, RG94; jalons/l3c/modele.md
// §8, EC-L3C-A-5). Queued by the doors of 0308 and 0309 (one decision = one e-mail, key
// campaign.decision:<entry, intervention or campaign>) and written by the worker at consumption from
// INFLUX's translation files (src/locales/<language>/email.json, `campaignDecision`), like
// profile.decision for a brand profile: no Brevo template (D69), no link nor domain in the text (RG158,
// the output check of the connector refuses any), no amount (D48, D78).
// What it says: the type of the campaign and the day of the act, never a title, a text of the
// campaign, a value, a band, the internal comment, the opinion nor the agent (modele §8). The message of
// a refusal is the one of its reason (RG90, word for word, D78 for the amount); only the reasons
// `illicit_content` and `other` carry a text written by the agent (20 to 500 characters): it is
// escaped, never formatted as a template, and the output check of the connector refuses it when it
// looks like a link. The reason of an intervention is its typed code (RG94: the brand is told why).
import type { UiLocale } from "@influx/contracts/auth";
import english from "../../locales/en/email.json" with { type: "json" };
import french from "../../locales/fr/email.json" with { type: "json" };
import {
  DEFAULT_EMAIL_TIME_ZONE,
  escapeHtml,
  format,
  type RenderedEmail,
} from "../identity/login-code-email.ts";
import { dayOf } from "../profiles/creator/decision-email.ts";

type EmailMessages = typeof french;
type Texts = EmailMessages["email"]["campaignDecision"];

const MESSAGES: Readonly<Record<UiLocale, EmailMessages>> = {
  fr: french,
  en: english,
};

/** The closed list of `email_code` of a campaign.decision line (modele §8). */
export const CAMPAIGN_DECISION_EMAIL_CODES = [
  "published",
  "rejected",
  "paused_by_influx",
  "resumed_by_influx",
  "closed_by_influx",
  "closed_automatically",
  "corrected",
  "created_for_brand",
] as const;
export type CampaignDecisionEmailCode =
  (typeof CAMPAIGN_DECISION_EMAIL_CODES)[number];

/** The section of the translation files each code speaks with. */
const SECTION_OF: Readonly<
  Record<
    Exclude<CampaignDecisionEmailCode, "rejected">,
    Exclude<
      keyof Texts,
      | "type"
      | "field"
      | "interventionReason"
      | "reason"
      | "nextStep"
      | "rejected"
    >
  >
> = {
  published: "published",
  paused_by_influx: "pausedByInflux",
  resumed_by_influx: "resumedByInflux",
  closed_by_influx: "closedByInflux",
  closed_automatically: "closedAutomatically",
  corrected: "corrected",
  created_for_brand: "createdForBrand",
};

/** The reasons of RG90 (campaigns.rejection_reasons, 0303): the closed list of a refusal. */
export type CampaignRejectionReasonCode = keyof Texts["reason"];
/** The type of the campaign (reference.campaign_types, 0303). */
export type CampaignTypeCode = keyof Texts["type"];
/** The reasons of an intervention of an agent (RG94, campaigns.agent_interventions, 0309). */
export type InterventionReasonCode = keyof Texts["interventionReason"];
/** The field a correction names (campaigns.agent_interventions.field_code, 0309). */
export type CampaignFieldCode = keyof Texts["field"];

/** What the brand can do next after a refusal (RG90, third column), by reason. */
const NEXT_STEP: Readonly<
  Record<CampaignRejectionReasonCode, keyof Texts["nextStep"]>
> = {
  contact_in_text: "fix",
  amount_in_text: "fix",
  link_in_text: "fix",
  brief_insufficient: "fix",
  deliverables_inconsistent: "fix",
  budget_inconsistent: "fix",
  calendar_invalid: "fix",
  creator_personal_criterion: "fix",
  minor_audience: "fix",
  concealed_advertising: "fix",
  duplicate: "fix",
  sensitive_authorizations_missing: "contact",
  illicit_content: "contact",
  other: "contact",
};

/** The reasons whose message is written by the agent (campaigns.rejection_reasons.requires_member_message). */
const REASONS_WITH_MESSAGE: ReadonlySet<CampaignRejectionReasonCode> = new Set([
  "illicit_content",
  "other",
]);

function known<T extends string>(
  list: Readonly<Record<T, unknown>>,
  code: string,
): T | null {
  return Object.hasOwn(list, code) ? (code as T) : null;
}

/** The e-mail code of the closed list, or null for a code outside it (never guessed). */
export function campaignDecisionEmailCodeOf(
  code: string,
): CampaignDecisionEmailCode | null {
  return (CAMPAIGN_DECISION_EMAIL_CODES as readonly string[]).includes(code)
    ? (code as CampaignDecisionEmailCode)
    : null;
}

/** The reason of RG90, or null for a code outside the closed list. */
export function campaignRejectionReasonOf(
  code: string,
): CampaignRejectionReasonCode | null {
  return known(NEXT_STEP, code);
}

/** Whether the reason is told with a text written by the agent (RG90: `illicit_content`, `other`). */
export function campaignReasonNeedsMessage(
  reason: CampaignRejectionReasonCode,
): boolean {
  return REASONS_WITH_MESSAGE.has(reason);
}

/** The reason of an intervention (RG94), or null for a code outside the closed list. */
export function interventionReasonOf(
  code: string,
): InterventionReasonCode | null {
  return known(french.email.campaignDecision.interventionReason, code);
}

/** The field a correction names, or null for a code outside the closed list. */
export function campaignFieldOf(code: string): CampaignFieldCode | null {
  return known(french.email.campaignDecision.field, code);
}

/** The type of a campaign (RG18), or null for a code outside the closed list. */
export function campaignTypeOf(code: string): CampaignTypeCode | null {
  return known(french.email.campaignDecision.type, code);
}

type Common = {
  locale: UiLocale;
  type: CampaignTypeCode;
  /** The day of the act in the account's time zone, `YYYY-MM-DD`. */
  occurredOn: string;
};

export type CampaignDecisionEmailInput = Common &
  (
    | { code: "published" | "closed_automatically" | "created_for_brand" }
    | {
        code: "rejected";
        reason: CampaignRejectionReasonCode;
        /** The text written by the agent: `illicit_content` and `other` only (RG90). */
        memberMessage: string | null;
      }
    | {
        code: "paused_by_influx" | "resumed_by_influx" | "closed_by_influx";
        reason: InterventionReasonCode;
      }
    | {
        code: "corrected";
        reason: InterventionReasonCode;
        field: CampaignFieldCode;
      }
  );

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

export function renderCampaignDecisionEmail(
  input: CampaignDecisionEmailInput,
): RenderedEmail {
  const { locale } = input;
  const texts: Texts = MESSAGES[locale].email.campaignDecision;
  const timeZone = DEFAULT_EMAIL_TIME_ZONE;
  const values = {
    type: texts.type[input.type],
    date: dayOf(locale, input.occurredOn),
  };
  if (input.code === "rejected") {
    const section = texts.rejected;
    const paragraphs: string[] = [
      format(section.body, values, locale, timeZone),
      texts.reason[input.reason],
    ];
    if (REASONS_WITH_MESSAGE.has(input.reason)) {
      paragraphs.push(...linesOf(input.memberMessage ?? ""));
    }
    paragraphs.push(texts.nextStep[NEXT_STEP[input.reason]]);
    return assemble(locale, section, paragraphs, section.why);
  }
  const section = texts[SECTION_OF[input.code]];
  const paragraphs: string[] = [
    format(
      section.body,
      input.code === "corrected"
        ? { ...values, field: texts.field[input.field] }
        : values,
      locale,
      timeZone,
    ),
  ];
  if (
    input.code === "paused_by_influx" ||
    input.code === "resumed_by_influx" ||
    input.code === "closed_by_influx" ||
    input.code === "corrected"
  ) {
    paragraphs.push(texts.interventionReason[input.reason]);
  }
  paragraphs.push(section.next);
  return assemble(locale, section, paragraphs, section.why);
}

/**
 * The text of a refusal reason as the brand receives it (RG90, word for word), and what the brand can
 * do next: what the decision screen shows the agent BEFORE the decision. Read from the same
 * translation files as the e-mail, so that the preview cannot drift from the message. For
 * `illicit_content` and `other`, the message is the lead-in; the agent's own text follows it.
 */
export function campaignRejectionReasonPreview(
  locale: UiLocale,
  reason: CampaignRejectionReasonCode,
): { message: string; nextStep: string } {
  const texts: Texts = MESSAGES[locale].email.campaignDecision;
  return {
    message: texts.reason[reason],
    nextStep: texts.nextStep[NEXT_STEP[reason]],
  };
}
