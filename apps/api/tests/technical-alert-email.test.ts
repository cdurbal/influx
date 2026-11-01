// The e-mail internal.technical_alert (15 RG165; 02 §20.5): written by INFLUX, French then English,
// the code, the title, the instants in UTC, the measure and the threshold, the action; nothing of
// 02 §20.8. And its sending: one call per recipient, directly to the sender, never an address in a
// log line nor in the idempotency key.
import { describe, expect, it, vi } from "vitest";
import english from "../src/locales/en/email.json" with { type: "json" };
import french from "../src/locales/fr/email.json" with { type: "json" };
import {
  deliverTechnicalAlert,
  technicalAlertIdempotencyKey,
} from "../src/domains/ops/alert-delivery.ts";
import {
  renderTechnicalAlertEmail,
  TECHNICAL_ALERT_CODES,
  type TechnicalAlertEmailInput,
} from "../src/domains/ops/technical-alert-email.ts";
import type { TransactionalEmail } from "../src/platform/brevo-transactional.ts";

const OPENED = new Date("2026-10-22T07:58:00Z");
const OBSERVED = new Date("2026-10-22T08:28:00Z");

/** A value with every member the measure of each code names. */
const SAMPLE_VALUES: Readonly<
  Record<string, TechnicalAlertEmailInput["value"]>
> = {
  AL48: {
    sends: 40,
    medianDeliverySeconds: 75,
    p90DeliverySeconds: 200,
    noSignInShareBp: 1600,
    deliveredShareBp: 9500,
  },
  AL49: {
    target: "api_health",
    consecutiveFailures: 2,
    threshold: 2,
    failureCode: "status",
    statusCode: 503,
  },
  AL50: {
    lastBeatAt: "2026-10-22T07:56:30Z",
    ageSeconds: 90,
    thresholdSeconds: 60,
  },
  AL51: {},
  AL52: {
    requests: 200,
    serverErrors: 4,
    shareBp: 200,
    thresholdBp: 100,
    windowMinutes: 5,
  },
  AL53: {
    p95UpperMs: 2500,
    p95Beyond: 0,
    thresholdMs: 1000,
    windowMinutes: 10,
    requests: 812,
  },
  AL54: {
    target: "web_home_fr",
    durationMs: 2600,
    thresholdMs: 2000,
    probes: 3,
  },
  AL55: { callsPerMinute: 912.4, usualCallsPerMinute: null, limit: 300 },
  AL56: {
    requests: 900,
    throttled: 30,
    shareBp: 333,
    thresholdBp: 200,
    minCount: 20,
    windowMinutes: 15,
  },
  AL57: {
    service: "api",
    avgEventLoopDelayMs: 240.5,
    thresholdMs: 200,
    memoryShareBp: null,
    windowMinutes: 5,
  },
  AL58: { connections: 85, maxConnections: 100, thresholdBp: 8000, samples: 3 },
  AL59: { failures: 31, threshold: 25 },
  AL60: {
    runId: "3f2b0d8e-0000-4000-8000-000000000001",
    finishedAt: "2026-10-22T08:00:12Z",
    realignFailed: 2,
    breaker: null,
  },
  AL61: {
    authenticated: 50,
    ignored: 12,
    shareBp: 2400,
    thresholdBp: 1000,
    windowHours: 24,
  },
  AL62: { occurrences: 1, lastAt: "2026-10-22T08:20:00Z" },
  AL63: {
    executionId: "7c9e6679-7425-40de-944b-e07fc1f90ae7",
    executedAt: "2026-10-21T07:00:00Z",
    thresholdHours: 24,
  },
};

/** Intl writes French with narrow no-break spaces (2 500 ms, 2 %): compared as plain spaces. */
function plain(text: string): string {
  return text.replace(/[\u00a0\u202f]/g, " ");
}

function input(
  code: string,
  kind: TechnicalAlertEmailInput["kind"] = "raised",
): TechnicalAlertEmailInput {
  return {
    code,
    kind,
    sequence: kind === "reminder" ? 2 : 1,
    openedAt: OPENED,
    observedAt: OBSERVED,
    value: SAMPLE_VALUES[code] ?? {},
  };
}

describe("15 RG165: content of internal.technical_alert", () => {
  it("knows AL48 and AL49 to AL63, with the same keys in French and in English", () => {
    expect([...TECHNICAL_ALERT_CODES].sort()).toEqual(
      [
        "AL48",
        ...Array.from({ length: 15 }, (_, index) => `AL${String(49 + index)}`),
      ].sort(),
    );
    expect(
      Object.keys(english.email.internal.technicalAlert.codes).sort(),
    ).toEqual(Object.keys(french.email.internal.technicalAlert.codes).sort());
  });

  it.each(Object.keys(SAMPLE_VALUES).filter((code) => code !== "AL51"))(
    "renders %s raised, recalled and resolved, every placeholder filled",
    (code) => {
      for (const kind of ["raised", "reminder", "resolved"] as const) {
        const { subject, text, html } = renderTechnicalAlertEmail(
          input(code, kind),
        );
        expect(subject).toContain(code);
        expect(text).not.toMatch(/\{\w+/);
        expect(text).toContain("Alerte technique INFLUX");
        expect(text).toContain("INFLUX technical alert");
        expect(html).toContain('<div lang="en">');
      }
    },
  );

  it("says the measure, the threshold and the action of AL52 in both languages", () => {
    const { subject, text: raw } = renderTechnicalAlertEmail(input("AL52"));
    const text = plain(raw);
    expect(subject).toBe(
      "INFLUX — AL52 : Taux d'erreurs serveur / Server error rate",
    );
    expect(text).toContain(
      "4 réponses 5xx sur 200 en 5 min, soit 2 % (seuil : 1 %).",
    );
    expect(text).toContain(
      "4 5xx responses out of 200 in 5 min, that is 2% (threshold: 1%).",
    );
    expect(text).toContain("Trouver la route en cause");
    expect(text).toContain("Constat du 22 octobre 2026 à 08:28:00 (UTC).");
  });

  it("names the target of the probe and the p95 by its bucket", () => {
    expect(renderTechnicalAlertEmail(input("AL49")).text).toContain(
      "Cible : /health de l'API (réseau privé, vérifie la base).",
    );
    expect(plain(renderTechnicalAlertEmail(input("AL53")).text)).toContain(
      "p95 de l'API sur 10 min : ≤ 2 500 ms",
    );
  });

  it("recalls with the opening instant and the reminder number; resolves without the action", () => {
    const reminder = renderTechnicalAlertEmail(input("AL50", "reminder")).text;
    expect(reminder).toContain("rappel n° 2");
    expect(reminder).toContain("Levée le 22 octobre 2026 à 07:58:00 (UTC).");
    const resolved = renderTechnicalAlertEmail(input("AL50", "resolved"));
    expect(resolved.subject).toBe(
      "INFLUX — AL50 rétabli : Worker arrêté / Worker stopped",
    );
    expect(resolved.text).not.toContain("redémarrer");
  });

  it("lists the groups of AL51, with their route model and identifier only", () => {
    const { text } = renderTechnicalAlertEmail({
      ...input("AL51"),
      groups: {
        newGroups: [
          {
            id: "g-1",
            errorType: "TypeError",
            route: "/v1/signup",
            at: "2026-10-22T08:27:00Z",
          },
        ],
        regressions: [
          {
            id: "g-2",
            errorType: "RangeError",
            route: null,
            at: "2026-10-22T08:27:30Z",
          },
        ],
        digest: false,
      },
    });
    expect(text).toContain("Nouveaux groupes d'erreurs serveur : 1.");
    expect(text).toContain("TypeError sur /v1/signup — groupe g-1");
    expect(text).toContain("RangeError on outside a request — group g-2");
  });

  it("holds no address, no link and no image (02 §20.8)", () => {
    for (const code of Object.keys(SAMPLE_VALUES)) {
      const { subject, text, html } = renderTechnicalAlertEmail(input(code));
      for (const part of [subject, text, html]) {
        expect(part).not.toContain("@");
        expect(part).not.toMatch(/https?:\/\//);
        expect(part).not.toContain("<img");
      }
    }
  });
});

describe("deliverTechnicalAlert: directly, one recipient per call (02 §20.5, 16 RG91)", () => {
  function logger() {
    return { info: vi.fn(), warn: vi.fn() };
  }

  it("sends to each recipient, with a key that differs per recipient and carries no address", async () => {
    const sent: TransactionalEmail[] = [];
    const log = logger();
    const delivered = await deliverTechnicalAlert(
      {
        sender: {
          send: async (email) => {
            sent.push(email);
            return {
              status: "sent",
              messageId: `<${String(sent.length)}@brevo>`,
            };
          },
        },
        logger: log,
      },
      input("AL49"),
      "api_health",
      ["ops@influx.example", "dev@influx.example"],
    );
    expect(delivered).toBe(true);
    expect(sent.map((email) => [email.template, email.to])).toEqual([
      ["internal.technical_alert", "ops@influx.example"],
      ["internal.technical_alert", "dev@influx.example"],
    ]);
    expect(new Set(sent.map((email) => email.idempotencyKey)).size).toBe(2);
    for (const email of sent) {
      expect(email.idempotencyKey).toMatch(
        /^internal\.technical_alert:AL49:[0-9a-f]{32}$/,
      );
    }
    expect(JSON.stringify(log.info.mock.calls)).not.toContain("@");
    expect(log.info).toHaveBeenCalledWith(
      { code: "AL49", kind: "raised", recipients: 2, accepted: 2 },
      "ops.alert.sent",
    );
  });

  it("is false when nobody accepted it, and logs the failure codes only", async () => {
    const log = logger();
    const delivered = await deliverTechnicalAlert(
      {
        sender: {
          send: () =>
            Promise.reject(new Error("socket hang up ops@influx.example")),
        },
        logger: log,
      },
      input("AL52"),
      "",
      ["ops@influx.example"],
    );
    expect(delivered).toBe(false);
    expect(log.warn).toHaveBeenCalledWith(
      {
        code: "AL52",
        kind: "raised",
        recipients: 1,
        accepted: 0,
        failureCodes: { provider_unavailable: 1 },
      },
      "ops.alert.delivery_failed",
    );
    expect(JSON.stringify(log.warn.mock.calls)).not.toContain("@");
  });

  it("calls nothing without a recipient", async () => {
    const send = vi.fn();
    const log = logger();
    expect(
      await deliverTechnicalAlert(
        { sender: { send }, logger: log },
        input("AL52"),
        "",
        [],
      ),
    ).toBe(false);
    expect(send).not.toHaveBeenCalled();
    expect(log.warn).toHaveBeenCalledWith(
      { code: "AL52", kind: "raised" },
      "ops.alert.no_recipient",
    );
  });

  it("keys a reminder apart from the raise, and the same e-mail the same way", () => {
    const raised = technicalAlertIdempotencyKey(
      input("AL52"),
      "",
      "ops@influx.example",
    );
    expect(
      technicalAlertIdempotencyKey(input("AL52"), "", "ops@influx.example"),
    ).toBe(raised);
    expect(
      technicalAlertIdempotencyKey(
        input("AL52", "reminder"),
        "",
        "ops@influx.example",
      ),
    ).not.toBe(raised);
  });
});
