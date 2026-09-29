// The Brevo transactional sender of the api, against the Brevo double of @influx/test-kit on the
// loopback (16 RG148: no test ever reaches Brevo). 02 §18.4 G1, G2; §18.6 circuit breaker; §12.4
// locks 2 and 3 (EC-19); lead-pipeline T10 (no retry); C-1 on the log stream.
import {
  startBrevoDouble,
  type BrevoDouble,
} from "@influx/test-kit/brevo-double";
import { valuesFoundIn } from "@influx/test-kit/logs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  CIRCUIT_FAILURE_THRESHOLD,
  CIRCUIT_OPEN_MS,
  createTransactionalSender,
  type TransactionalEmail,
  type TransactionalSenderSettings,
} from "../src/platform/brevo-transactional.ts";

const RECIPIENT = "reader-7f3a@example.test";
const EMAIL: TransactionalEmail = {
  template: "auth.login_code",
  to: RECIPIENT,
  subject: "Votre code de connexion INFLUX",
  html: "<p>913482</p>",
  text: "913482",
  idempotencyKey: "auth.login_code:4242",
};

let double: BrevoDouble;
let lines: string[];

function logger() {
  const write = (level: string) => (object: object, message: string) => {
    lines.push(`${level} ${message} ${JSON.stringify(object)}`);
  };
  return { info: write("info"), warn: write("warn"), error: write("error") };
}

function sender(
  overrides: Partial<TransactionalSenderSettings> = {},
  dependencies: { now?: () => number; timeoutMs?: number } = {},
) {
  return createTransactionalSender(
    {
      mode: "redirect",
      testRecipients: [RECIPIENT],
      apiKey: "local-double-key",
      baseUrl: double.baseUrl,
      senderEmail: "no-reply@tx.influx.example",
      ...overrides,
    },
    { logger: logger(), ...dependencies },
  );
}

beforeAll(async () => {
  double = await startBrevoDouble();
});

afterAll(async () => {
  await double.close();
});

beforeEach(() => {
  double.reset();
  lines = [];
});

describe("one unitary send (02 §18.10 step 7)", () => {
  it("posts one message to /smtp/email, with the key, the Idempotency-Key and one recipient", async () => {
    const outcome = await sender().send(EMAIL);
    expect(outcome.status).toBe("sent");
    expect(double.messages).toHaveLength(1);
    const [message] = double.messages;
    expect(message?.path).toBe("/v3/smtp/email");
    expect(message?.headers["api-key"]).toBe("local-double-key");
    expect(message?.headers["idempotency-key"]).toBe("auth.login_code:4242");
    expect(message?.body).toEqual({
      sender: { name: "INFLUX", email: "no-reply@tx.influx.example" },
      to: [{ email: RECIPIENT }],
      subject: EMAIL.subject,
      htmlContent: EMAIL.html,
      textContent: EMAIL.text,
      tags: ["auth.login_code"],
    });
    expect(message?.body).not.toHaveProperty("cc");
    expect(message?.body).not.toHaveProperty("bcc");
    expect(message?.body).not.toHaveProperty("replyTo");
  });

  it("returns Brevo's message id", async () => {
    double.queue({ status: 201, body: { messageId: "<id-1@double>" } });
    expect(await sender().send(EMAIL)).toEqual({
      status: "sent",
      messageId: "<id-1@double>",
    });
  });

  it("refuses a template outside the closed list of the api (EC-19 point 3)", async () => {
    await expect(
      sender().send({
        ...EMAIL,
        template: "marketing.newsletter" as TransactionalEmail["template"],
      }),
    ).rejects.toThrow("closed list");
    expect(double.messages).toHaveLength(0);
  });
});

describe("one attempt, never a retry (G2, lead-pipeline T10)", () => {
  it.each([
    [500, "unavailable"],
    [503, "unavailable"],
    [429, "unavailable"],
    [401, "unavailable"],
    [403, "unavailable"],
  ] as const)(
    "answers %i with %s after exactly one call",
    async (status, expected) => {
      double.queue({ status, body: { code: "some_code", message: RECIPIENT } });
      expect(await sender().send(EMAIL)).toEqual({ status: expected });
      expect(double.messages).toHaveLength(1);
    },
  );

  it("reads a 400 invalid_parameter as a refusal of the address, cause (a)", async () => {
    double.queue({
      status: 400,
      body: { code: "invalid_parameter", message: `${RECIPIENT} invalid` },
    });
    expect(await sender().send(EMAIL)).toEqual({ status: "undeliverable" });
    expect(double.messages).toHaveLength(1);
  });

  it("stops at the time-out of the call (G1), without retry", async () => {
    double.queue({ status: 201, delayMs: 1_000 });
    const started = performance.now();
    expect(await sender({}, { timeoutMs: 100 }).send(EMAIL)).toEqual({
      status: "unavailable",
    });
    expect(performance.now() - started).toBeLessThan(900);
    expect(double.messages).toHaveLength(1);
  });

  it("reads a closed connection as unavailable", async () => {
    double.queue({ status: 0, destroy: true });
    expect(await sender().send(EMAIL)).toEqual({ status: "unavailable" });
  });

  it("reads a 2xx without a message id as unavailable", async () => {
    double.queue({ status: 201, body: {} });
    expect(await sender().send(EMAIL)).toEqual({ status: "unavailable" });
  });
});

describe("circuit breaker (02 §18.6)", () => {
  it("opens after five transport failures, answers at once for 30 s, then one trial closes it", async () => {
    let clock = 0;
    const subject = sender({}, { now: () => clock });
    for (let failure = 0; failure < CIRCUIT_FAILURE_THRESHOLD; failure += 1) {
      double.queue({ status: 503 });
      expect(await subject.send(EMAIL)).toEqual({ status: "unavailable" });
    }
    expect(double.messages).toHaveLength(CIRCUIT_FAILURE_THRESHOLD);
    // Open: no call.
    expect(await subject.send(EMAIL)).toEqual({ status: "unavailable" });
    clock += CIRCUIT_OPEN_MS - 1;
    expect(await subject.send(EMAIL)).toEqual({ status: "unavailable" });
    expect(double.messages).toHaveLength(CIRCUIT_FAILURE_THRESHOLD);
    // Trial call, failed: reopened for 30 s.
    clock += 1;
    double.queue({ status: 503 });
    expect(await subject.send(EMAIL)).toEqual({ status: "unavailable" });
    expect(double.messages).toHaveLength(CIRCUIT_FAILURE_THRESHOLD + 1);
    expect(await subject.send(EMAIL)).toEqual({ status: "unavailable" });
    expect(double.messages).toHaveLength(CIRCUIT_FAILURE_THRESHOLD + 1);
    // Trial call, successful: closed again.
    clock += CIRCUIT_OPEN_MS;
    expect((await subject.send(EMAIL)).status).toBe("sent");
    expect((await subject.send(EMAIL)).status).toBe("sent");
    expect(double.messages).toHaveLength(CIRCUIT_FAILURE_THRESHOLD + 3);
  });

  it("counts CONSECUTIVE failures: an answer resets the count", async () => {
    const subject = sender({}, { now: () => 0 });
    for (let round = 0; round < 3; round += 1) {
      for (let failure = 1; failure < CIRCUIT_FAILURE_THRESHOLD; failure += 1) {
        double.queue({ status: 500 });
        await subject.send(EMAIL);
      }
      expect((await subject.send(EMAIL)).status).toBe("sent");
    }
  });
});

describe("environment locks (02 §12.4 locks 2 and 3, 16 RG116, EC-19)", () => {
  it("disabled: no call, and never a false success", async () => {
    expect(await sender({ mode: "disabled" }).send(EMAIL)).toEqual({
      status: "unavailable",
    });
    expect(double.messages).toHaveLength(0);
  });

  it("redirect: an address outside BREVO_TEST_RECIPIENTS is set aside without a call", async () => {
    expect(
      await sender().send({ ...EMAIL, to: "someone-else@example.test" }),
    ).toEqual({ status: "undeliverable" });
    expect(double.messages).toHaveLength(0);
  });

  it("redirect: a listed address is compared in lower case", async () => {
    expect(
      (await sender({ testRecipients: [RECIPIENT.toUpperCase()] }).send(EMAIL))
        .status,
    ).toBe("sent");
  });
});

describe("C-1: nothing of the message in the log lines", () => {
  it("logs neither the recipient, nor the subject, nor the body, nor Brevo's message", async () => {
    double.queue(
      { status: 400, body: { code: "invalid_parameter", message: RECIPIENT } },
      { status: 500, body: { code: "x", message: RECIPIENT } },
      { status: 201, delayMs: 500 },
    );
    const subject = sender({}, { timeoutMs: 100 });
    await subject.send(EMAIL);
    await subject.send(EMAIL);
    await subject.send(EMAIL);
    await sender().send({ ...EMAIL, to: "unlisted-9c1d@example.test" });
    await sender({ mode: "disabled" }).send(EMAIL);
    expect(lines.length).toBeGreaterThan(3);
    expect(
      valuesFoundIn(lines.join("\n"), [
        RECIPIENT,
        "unlisted-9c1d@example.test",
        "913482",
        EMAIL.subject,
        "local-double-key",
      ]),
    ).toEqual([]);
  });
});
