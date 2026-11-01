// The e-mail `internal.critical_alert` (docs/mvp/16 §H, RG86; 21 §3 EC-44; J6 start decision 1).
// Fixed content, French then English in the same e-mail (D36, language of the backoffice, is
// open): the type of the alert, its UTC instant, the audit reference and, for a recovery code,
// the codes left (MFA-4). NEVER an address, an IP, a browser, a name nor a code: the recipient
// reads the rest in the audit register. Texts live in src/locales/<language>/email.json.
import type { UiLocale } from "@influx/contracts/auth";
import english from "../../locales/en/email.json" with { type: "json" };
import french from "../../locales/fr/email.json" with { type: "json" };
import {
  formatInternalText as format,
  renderInternalEmail,
} from "../../platform/internal-email.ts";
import type { RenderedEmail } from "./login-code-email.ts";

/** The two audit events that raise the alert (EC-44 (1)). */
export type CriticalAlertEvent =
  "agent.break_glass_login" | "agent.recovery_code_consumed";

export type CriticalAlertEmailInput = {
  eventType: CriticalAlertEvent;
  occurredAt: Date;
  /** The seq of the audit line, as the register shows it. */
  auditReference: string;
  /** Codes left after a recovery code; null for a break-glass sign-in. */
  recoveryCodesLeft: number | null;
};

/** French first: the order of the bilingual body. */
const LANGUAGES: readonly { locale: UiLocale; texts: Texts }[] = [
  { locale: "fr", texts: french.email.internal.criticalAlert },
  { locale: "en", texts: english.email.internal.criticalAlert },
];

type Texts = typeof french.email.internal.criticalAlert;

function paragraphsOf(
  input: CriticalAlertEmailInput,
  locale: UiLocale,
  texts: Texts,
): string[] {
  const fact =
    input.eventType === "agent.break_glass_login"
      ? texts.breakGlassLogin
      : format(
          texts.recoveryCodeConsumed,
          { remaining: input.recoveryCodesLeft ?? 0 },
          locale,
        );
  return [
    fact,
    format(texts.occurredAt, { occurredAt: input.occurredAt }, locale),
    format(texts.auditReference, { reference: input.auditReference }, locale),
    texts.action,
  ];
}

export function renderCriticalAlertEmail(
  input: CriticalAlertEmailInput,
): RenderedEmail {
  const subject = french.email.internal.criticalAlert.subject;
  const blocks = LANGUAGES.map(({ locale, texts }) => ({
    locale,
    title: texts.title,
    paragraphs: paragraphsOf(input, locale, texts),
  }));
  return renderInternalEmail(subject, blocks);
}
