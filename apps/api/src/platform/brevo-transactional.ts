// The Brevo transactional sender of the api process (docs/mvp/02 §18.4 to §18.10; 16 RG116,
// RG117, RG156; 21 §3 EC-19, J3-C rule 10). ONE call, and one only: the unitary transactional
// send `POST /smtp/email`, for a template of a closed list. Every other Brevo path (contacts,
// lists, campaigns…) belongs to the worker and is never importable from the api (static guard,
// tests/brevo-guard.test.ts).
// - One attempt, never a retry (G2, 05 RG60, lead-pipeline T10). A bounded time-out (G1).
// - The environment locks of 02 §12.4, applied at the last moment, just before the call:
//   `disabled` calls nothing; `redirect` sends only to an address of BREVO_TEST_RECIPIENTS (the
//   positive condition of verrou 3), any other recipient is set aside without a call; `live`
//   sends (production only, checked at startup).
// - A global circuit breaker (02 §18.6): after five consecutive transport failures, every send
//   fails at once for thirty seconds, then one trial call closes or reopens it. Global: its state
//   depends on no address, so it is no oracle.
// - Nothing of the message is logged: no address, no subject, no body (C-1). A line carries the
//   template, the HTTP status and Brevo's error code at most.
import type { BrevoMode } from "../config/schema.ts";

/**
 * Closed list of the templates the api may send (EC-19 point 3; EC-44, the P0 alert, J6; the two
 * codes of an address change, sent synchronously, J7 decision 5; the technical alerts of D60, sent
 * directly by the api (AL50) and by the worker with its own key, never through the queue, 15
 * RG165).
 */
export const API_TRANSACTIONAL_TEMPLATES = [
  "auth.login_code",
  "internal.critical_alert",
  "auth.email_change_confirm_old",
  "auth.email_change_confirm_new",
  "internal.technical_alert",
] as const;
export type ApiTransactionalTemplate =
  (typeof API_TRANSACTIONAL_TEMPLATES)[number];

/** The one Brevo path of the api process. */
const SEND_PATH = "/smtp/email";

/** Sender name of the transactional flow (16 RG156). */
const SENDER_NAME = "INFLUX";

/** G1: bound of the call to Brevo, in milliseconds (02 §18.4). */
export const BREVO_SEND_TIMEOUT_MS = 3_000;

/** 02 §18.6: failures that open the circuit, and how long it stays open. */
export const CIRCUIT_FAILURE_THRESHOLD = 5;
export const CIRCUIT_OPEN_MS = 30_000;

export type TransactionalEmail = {
  template: ApiTransactionalTemplate;
  /** Normalised address of the recipient: one recipient, never a copy (16 RG91). */
  to: string;
  subject: string;
  html: string;
  text: string;
  /** `Idempotency-Key` header (02 §18.10 step 7). */
  idempotencyKey: string;
};

/**
 * `sent`: accepted by Brevo, with its message id. `undeliverable`: Brevo refused the address
 * itself, or, outside production, the address is not one of the test recipients. `unavailable`:
 * anything else, including the circuit being open and BREVO_MODE=disabled.
 */
export type SendOutcome =
  | { status: "sent"; messageId: string }
  | { status: "undeliverable" }
  | { status: "unavailable" };

export type TransactionalSender = {
  send(email: TransactionalEmail): Promise<SendOutcome>;
};

export type SenderLogger = {
  info(object: object, message: string): void;
  warn(object: object, message: string): void;
  error(object: object, message: string): void;
};

export type TransactionalSenderSettings = {
  mode: BrevoMode;
  /** Closed list of internal addresses, lower case (BREVO_TEST_RECIPIENTS). */
  testRecipients: readonly string[];
  apiKey: string | null;
  baseUrl: string;
  senderEmail: string | null;
};

export type SenderDependencies = {
  logger: SenderLogger;
  fetch?: typeof fetch;
  /** Milliseconds since an arbitrary origin; injectable for the circuit tests. */
  now?: () => number;
  timeoutMs?: number;
};

type CircuitState =
  | { state: "closed"; consecutiveFailures: number }
  | { state: "open"; until: number }
  | { state: "trial" };

/** Brevo's error code, when the answer is a JSON object that carries one; never its message. */
async function brevoErrorCodeOf(response: Response): Promise<string | null> {
  try {
    const body: unknown = await response.json();
    if (typeof body === "object" && body !== null && "code" in body) {
      const code = (body as { code: unknown }).code;
      return typeof code === "string" && /^[a-z_]{1,40}$/.test(code)
        ? code
        : null;
    }
  } catch {
    // Not JSON: no code to report; the status is logged by the caller.
  }
  return null;
}

async function messageIdOf(response: Response): Promise<string | null> {
  try {
    const body: unknown = await response.json();
    if (typeof body === "object" && body !== null && "messageId" in body) {
      const id = (body as { messageId: unknown }).messageId;
      return typeof id === "string" && id.length > 0 && id.length <= 998
        ? id
        : null;
    }
  } catch {
    // A 2xx without a readable message id is treated as a transport failure by the caller.
  }
  return null;
}

export function createTransactionalSender(
  settings: TransactionalSenderSettings,
  dependencies: SenderDependencies,
): TransactionalSender {
  const { logger } = dependencies;
  const doFetch = dependencies.fetch ?? fetch;
  const now = dependencies.now ?? (() => performance.now());
  const timeoutMs = dependencies.timeoutMs ?? BREVO_SEND_TIMEOUT_MS;
  const testRecipients = new Set(
    settings.testRecipients.map((address) => address.toLowerCase()),
  );
  let circuit: CircuitState = { state: "closed", consecutiveFailures: 0 };

  /** Whether a call may go out now; moves an expired open circuit to its trial call. */
  function mayCall(): boolean {
    if (circuit.state === "closed") {
      return true;
    }
    if (circuit.state === "open" && now() >= circuit.until) {
      circuit = { state: "trial" };
      return true;
    }
    return false;
  }

  function recordTransportFailure(): void {
    if (circuit.state === "trial") {
      circuit = { state: "open", until: now() + CIRCUIT_OPEN_MS };
      logger.error({}, "Brevo circuit reopened after a failed trial");
      return;
    }
    if (circuit.state === "closed") {
      const failures = circuit.consecutiveFailures + 1;
      if (failures >= CIRCUIT_FAILURE_THRESHOLD) {
        circuit = { state: "open", until: now() + CIRCUIT_OPEN_MS };
        logger.error({ failures }, "Brevo circuit opened");
      } else {
        circuit = { state: "closed", consecutiveFailures: failures };
      }
    }
  }

  function recordAnswer(): void {
    if (circuit.state !== "closed" || circuit.consecutiveFailures !== 0) {
      circuit = { state: "closed", consecutiveFailures: 0 };
    }
  }

  async function call(email: TransactionalEmail): Promise<SendOutcome> {
    if (!mayCall()) {
      logger.warn({ template: email.template }, "Brevo circuit open");
      return { status: "unavailable" };
    }
    let response: Response;
    try {
      response = await doFetch(`${settings.baseUrl}${SEND_PATH}`, {
        method: "POST",
        headers: {
          "api-key": settings.apiKey ?? "",
          accept: "application/json",
          "content-type": "application/json",
          "Idempotency-Key": email.idempotencyKey,
        },
        body: JSON.stringify({
          sender: { name: SENDER_NAME, email: settings.senderEmail },
          to: [{ email: email.to }],
          subject: email.subject,
          htmlContent: email.html,
          textContent: email.text,
          tags: [email.template],
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      // Time-out or network: a transport failure. The error is not logged (its message may
      // quote the URL); its name is enough.
      recordTransportFailure();
      logger.warn(
        {
          template: email.template,
          failure: error instanceof Error ? error.name : "unknown",
        },
        "Brevo send failed in transport",
      );
      return { status: "unavailable" };
    }
    if (response.ok) {
      const messageId = await messageIdOf(response);
      if (messageId === null) {
        recordTransportFailure();
        logger.error(
          { template: email.template, statusCode: response.status },
          "Brevo accepted a send without a message id",
        );
        return { status: "unavailable" };
      }
      recordAnswer();
      return { status: "sent", messageId };
    }
    const brevoCode = await brevoErrorCodeOf(response);
    if (response.status >= 500 || response.status === 429) {
      recordTransportFailure();
      logger.warn(
        { template: email.template, statusCode: response.status, brevoCode },
        "Brevo send refused by an unavailable provider",
      );
      return { status: "unavailable" };
    }
    // A 4xx answer: Brevo is up. An invalid parameter of a unitary send whose other parameters
    // are ours is taken as a refusal of the address (02 §18.5 cause (a)); any other refusal
    // (key, permission, sender) is a configuration fault, reported as unavailable.
    recordAnswer();
    if (response.status === 400 && brevoCode === "invalid_parameter") {
      logger.info(
        { template: email.template, statusCode: response.status, brevoCode },
        "Brevo refused the address",
      );
      return { status: "undeliverable" };
    }
    logger.error(
      { template: email.template, statusCode: response.status, brevoCode },
      "Brevo refused the send",
    );
    return { status: "unavailable" };
  }

  return {
    async send(email) {
      if (
        !(API_TRANSACTIONAL_TEMPLATES as readonly string[]).includes(
          email.template,
        )
      ) {
        throw new Error("template outside the closed list of the api");
      }
      if (settings.mode === "disabled") {
        // 16 RG116: no outbound call. For the login code, never a false success (05 RG64).
        logger.info(
          { template: email.template },
          "Brevo disabled: send not made",
        );
        return { status: "unavailable" };
      }
      if (settings.mode === "redirect" && !testRecipients.has(email.to)) {
        // 02 §12.4 verrou 3: a positive condition, evaluated just before the call.
        logger.warn(
          { template: email.template },
          "recipient outside BREVO_TEST_RECIPIENTS: send set aside",
        );
        return { status: "undeliverable" };
      }
      if (settings.apiKey === null || settings.senderEmail === null) {
        // Unreachable: the configuration refuses a sending mode without key or sender.
        throw new Error("Brevo key or sender missing");
      }
      return call(email);
    },
  };
}
