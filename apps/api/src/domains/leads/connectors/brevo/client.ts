// The Brevo calls of the worker (docs/mvp/16 §M1, operations 1, 2, 6 and 7; read on 2026-09-19,
// RG150; the address change of decision 5 of J7, read on 2026-10-09), each bounded in time (02 §18.4 G1: 3 s), and the classification of the answers into the
// three classes of 16 §M5. Never imported by the HTTP process (static guard, brevo-guard.test.ts).
// Nothing of a request or of Brevo's message reaches a log line or a cause: the HTTP status and
// Brevo's error code at most (D60, 05 RG99).
import type { CallResult } from "../../connector.ts";

/** G1: bound of each call to Brevo, in milliseconds (02 §18.4). */
export const BREVO_CALL_TIMEOUT_MS = 3_000;
/** 16 §M5, authentication class: the destination stops for an hour, for a human to act. */
export const UNAUTHORIZED_STOP_SECONDS = 3_600;

const CONTACTS_PATH = "/contacts";
const SMTP_PATH = "/smtp/email";

export type BrevoClientLogger = {
  error(object: object, message: string): void;
};

/**
 * How Brevo finds a known contact: its id, else its address (an address change, decision 5 of J7;
 * the deletion of an erased account, J8 commit 8).
 */
export type BrevoContactIdentifier = {
  type: "contact_id" | "email_id";
  value: string;
};

export type BrevoClient = {
  /** Operation 1: create, or update with updateEnabled (16 §M3: never a duplicate). */
  upsertContact(body: Record<string, unknown>): Promise<CallResult>;
  /** Operation 2 then 7: unsubscribe a known contact, then exclude it from marketing. */
  unsubscribeContact(
    email: string,
    body: Record<string, unknown>,
    suppressionListId: number | null,
  ): Promise<CallResult>;
  /**
   * 05 RG58, decision 5 of J7: the address of a known contact changed in place, by
   * `PUT /contacts/{identifier}?identifierType=…`; never a second contact.
   */
  updateContactEmail(
    identifier: BrevoContactIdentifier,
    body: Record<string, unknown>,
  ): Promise<CallResult>;
  /**
   * Operation 2 on account.deleted (16 §M1; 04 §9.2; 15 RG79): the contact deleted under EACH
   * identifier given, in order, by `DELETE /contacts/{identifier}?identifierType=…`. A success only
   * when every one answers 204 or 404: a stale contact id (404) never hides a contact still held
   * under the address (security review of J8 commit 8, F5).
   */
  deleteContact(
    identifiers: readonly BrevoContactIdentifier[],
  ): Promise<CallResult>;
  /** Operation 6: one recipient, the line's key as Idempotency-Key (16 RG89, RG90). */
  sendTransactional(
    body: Record<string, unknown>,
    idempotencyKey: string,
    locale: string,
  ): Promise<CallResult>;
};

export type BrevoClientSettings = {
  apiKey: string;
  baseUrl: string;
  /** For the log line of a refused key: which destination stops. */
  destination: string;
};

export type BrevoClientDependencies = {
  logger: BrevoClientLogger;
  fetch?: typeof fetch;
  timeoutMs?: number;
};

type Answer =
  | { kind: "answer"; status: number; headers: Headers; body: unknown }
  | { kind: "transport" };

/** Brevo's error code, when it is a plain code; never its message. */
function brevoCodeOf(body: unknown): string | null {
  if (typeof body === "object" && body !== null && "code" in body) {
    const code = (body as { code: unknown }).code;
    return typeof code === "string" && /^[a-z_]{1,40}$/.test(code)
      ? code
      : null;
  }
  return null;
}

/** Seconds before the next window (Retry-After, else Brevo's reset header), or undefined. */
function retryAfterOf(headers: Headers): number | undefined {
  for (const name of ["retry-after", "x-sib-ratelimit-reset"]) {
    const value = headers.get(name);
    if (value !== null && /^[0-9]{1,6}$/.test(value.trim())) {
      return Number(value.trim());
    }
  }
  return undefined;
}

export function createBrevoClient(
  settings: BrevoClientSettings,
  dependencies: BrevoClientDependencies,
): BrevoClient {
  const doFetch = dependencies.fetch ?? fetch;
  const timeoutMs = dependencies.timeoutMs ?? BREVO_CALL_TIMEOUT_MS;

  async function call(
    method: "POST" | "PUT" | "DELETE",
    path: string,
    body: Record<string, unknown> | null,
    headers: Record<string, string> = {},
  ): Promise<Answer> {
    let response: Response;
    let answerBody: unknown;
    try {
      response = await doFetch(`${settings.baseUrl}${path}`, {
        method,
        headers: {
          "api-key": settings.apiKey,
          accept: "application/json",
          ...(body === null ? {} : { "content-type": "application/json" }),
          ...headers,
        },
        ...(body === null ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      const text = await response.text();
      try {
        answerBody = text.length > 0 ? JSON.parse(text) : undefined;
      } catch {
        // Not JSON: no code to report; the status is enough.
      }
    } catch {
      // Time-out or network, while connecting or reading: the error may quote the URL, never kept.
      return { kind: "transport" };
    }
    return {
      kind: "answer",
      status: response.status,
      headers: response.headers,
      body: answerBody,
    };
  }

  /** 16 §M5: the answer that is not a success, in its class. */
  function failureOf(answer: Answer): CallResult {
    if (answer.kind === "transport") {
      return {
        kind: "retry",
        errorCode: "brevo.unreachable",
        errorMessage: "Brevo did not answer in time",
      };
    }
    const { status } = answer;
    if (status === 429) {
      const retryAfterSeconds = retryAfterOf(answer.headers);
      return {
        kind: "retry",
        errorCode: "brevo.rate_limited",
        errorMessage: "Brevo answered 429",
        ...(retryAfterSeconds === undefined ? {} : { retryAfterSeconds }),
        rateLimited: true,
      };
    }
    if (status >= 500) {
      return {
        kind: "retry",
        errorCode: "brevo.unavailable",
        errorMessage: `Brevo answered ${status}`,
      };
    }
    if (status === 401 || status === 403) {
      // 16 §M5: stop the queue of this destination (its budget paused an hour) and alert. The
      // marketing suspension (RG123) and the AL25 alert come with the switch (J8).
      dependencies.logger.error(
        { destination: settings.destination, statusCode: status },
        "leads.brevo.unauthorized",
      );
      return {
        kind: "retry",
        errorCode: "brevo.unauthorized",
        errorMessage: `Brevo answered ${status}`,
        retryAfterSeconds: UNAUTHORIZED_STOP_SECONDS,
        rateLimited: true,
      };
    }
    const code = brevoCodeOf(answer.body);
    return {
      kind: "failed",
      errorCode: "brevo.rejected",
      errorMessage: `Brevo answered ${status}${code === null ? "" : ` ${code}`}`,
    };
  }

  return {
    async upsertContact(body) {
      const answer = await call("POST", CONTACTS_PATH, body);
      if (answer.kind === "answer" && answer.status === 201) {
        const id =
          typeof answer.body === "object" && answer.body !== null
            ? (answer.body as { id?: unknown }).id
            : undefined;
        return typeof id === "number" || typeof id === "string"
          ? { kind: "succeeded", providerContactId: String(id) }
          : { kind: "succeeded" };
      }
      if (answer.kind === "answer" && answer.status === 204) {
        return { kind: "succeeded" };
      }
      return failureOf(answer);
    },

    async unsubscribeContact(email, body, suppressionListId) {
      const updated = await call(
        "PUT",
        `${CONTACTS_PATH}/${encodeURIComponent(email)}`,
        body,
      );
      if (updated.kind === "answer" && updated.status === 404) {
        // No contact at Brevo: nothing is subscribed, nothing to exclude.
        return { kind: "succeeded" };
      }
      if (updated.kind !== "answer" || updated.status !== 204) {
        return failureOf(updated);
      }
      if (suppressionListId === null) {
        return { kind: "succeeded" };
      }
      const listed = await call(
        "POST",
        `${CONTACTS_PATH}/lists/${suppressionListId}/contacts/add`,
        { emails: [email] },
      );
      if (listed.kind === "answer" && listed.status === 201) {
        return { kind: "succeeded" };
      }
      // 16 §M3: an address already in the list is "no further effect", Brevo answers 400
      // invalid_parameter; the contact exists (the update above found it).
      if (
        listed.kind === "answer" &&
        listed.status === 400 &&
        brevoCodeOf(listed.body) === "invalid_parameter"
      ) {
        return { kind: "succeeded" };
      }
      return failureOf(listed);
    },

    async updateContactEmail(identifier, body) {
      const answer = await call(
        "PUT",
        `${CONTACTS_PATH}/${encodeURIComponent(identifier.value)}?identifierType=${identifier.type}`,
        body,
      );
      if (answer.kind === "answer" && answer.status === 204) {
        return { kind: "succeeded" };
      }
      if (answer.kind === "answer" && answer.status === 404) {
        // No contact at Brevo: nothing to move. A replay of lead.created reads the current address.
        return { kind: "succeeded" };
      }
      // An address already held by another contact is a 400: failed, visible, replayable (J8).
      return failureOf(answer);
    },

    async deleteContact(identifiers) {
      for (const identifier of identifiers) {
        const answer = await call(
          "DELETE",
          `${CONTACTS_PATH}/${encodeURIComponent(identifier.value)}?identifierType=${identifier.type}`,
          null,
        );
        // 404: no contact under this identifier (never created, or already deleted).
        if (
          answer.kind !== "answer" ||
          (answer.status !== 204 && answer.status !== 404)
        ) {
          return failureOf(answer);
        }
      }
      return { kind: "succeeded" };
    },

    async sendTransactional(body, idempotencyKey, locale) {
      const answer = await call("POST", SMTP_PATH, body, {
        "Idempotency-Key": idempotencyKey,
      });
      if (answer.kind === "answer" && answer.status === 201) {
        const messageId =
          typeof answer.body === "object" && answer.body !== null
            ? (answer.body as { messageId?: unknown }).messageId
            : undefined;
        if (
          typeof messageId === "string" &&
          messageId.length > 0 &&
          messageId.length <= 200
        ) {
          return { kind: "succeeded", providerMessageId: messageId, locale };
        }
        // 16 RG94: a send without its messageId is no proof; retried under the same key.
        return {
          kind: "retry",
          errorCode: "brevo.no_message_id",
          errorMessage: "Brevo accepted the send without a message id",
        };
      }
      return failureOf(answer);
    },
  };
}
