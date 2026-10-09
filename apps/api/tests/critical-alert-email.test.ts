// The e-mail internal.critical_alert (16 §H, RG86; 21 §3 EC-44; J6 start decision 1): fixed
// content, French then English (D36 open), the type, the UTC instant, the audit reference and,
// for a recovery code, the codes left. Never an address, an IP, a browser, a name nor a code.
import { describe, expect, it } from "vitest";
import { renderCriticalAlertEmail } from "../src/domains/identity/critical-alert-email.ts";

const OCCURRED_AT = new Date("2026-10-09T06:42:17Z");

describe("EC-44: content of internal.critical_alert", () => {
  it("names the break-glass sign-in in both languages, with the UTC instant and the audit reference", () => {
    const { subject, text, html } = renderCriticalAlertEmail({
      eventType: "agent.break_glass_login",
      occurredAt: OCCURRED_AT,
      auditReference: "4817",
      recoveryCodesLeft: null,
    });
    expect(subject).toBe("INFLUX — Alerte critique / Critical alert");
    const lines = text.split("\n").filter((line) => line !== "");
    expect(lines).toEqual([
      "Alerte critique INFLUX",
      "Connexion au compte de secours du backoffice.",
      "Le 9 octobre 2026 à 06:42:17 (UTC).",
      "Référence d'audit : 4817",
      "Consultez le registre d'audit du backoffice. Si cette connexion n'était pas prévue, traitez-la comme un incident de sécurité.",
      "INFLUX critical alert",
      "Sign-in to the backoffice break-glass account.",
      "On October 9, 2026 at 06:42:17 (UTC).",
      "Audit reference: 4817",
      "Check the backoffice audit register. If this sign-in was not planned, treat it as a security incident.",
    ]);
    expect(html).toContain('<html lang="fr">');
    expect(html).toContain('<div lang="en">');
    expect(html).toContain("Référence d&#39;audit : 4817");
  });

  it("names a consumed recovery code with the number of codes left, in both languages", () => {
    const { text } = renderCriticalAlertEmail({
      eventType: "agent.recovery_code_consumed",
      occurredAt: OCCURRED_AT,
      auditReference: "4818",
      recoveryCodesLeft: 3,
    });
    expect(text).toContain(
      "Connexion au backoffice avec un code de secours. Codes restants sur ce compte : 3.",
    );
    expect(text).toContain(
      "Backoffice sign-in with a recovery code. Codes left on this account: 3.",
    );
    expect(text).toContain("Référence d'audit : 4818");
    expect(text).toContain("Audit reference: 4818");
  });

  it("holds no address, no link and no image (contenu sans @)", () => {
    for (const eventType of [
      "agent.break_glass_login",
      "agent.recovery_code_consumed",
    ] as const) {
      const email = renderCriticalAlertEmail({
        eventType,
        occurredAt: OCCURRED_AT,
        auditReference: "1",
        recoveryCodesLeft: eventType === "agent.break_glass_login" ? null : 0,
      });
      for (const part of [email.subject, email.text, email.html]) {
        expect(part).not.toContain("@");
        expect(part).not.toMatch(/https?:|<a |<img /);
      }
    }
  });
});
