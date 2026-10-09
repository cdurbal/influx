// The Apollo calls of the worker (Apollo REST API v1, contacts; drafted from Apollo's reference, to
// check against the recordings of the manual trial, J6 commit 7), each bounded in time (02 §18.4
// G1), and the classification of the answers (skill apollo-lead-sync "Gestion des erreurs"):
//   transient       5xx, transport, time-out: the schedule of 05 RG79
//   rate or quota   429: the category pauses for Apollo's delay (lead-pipeline T5), no lead lost
//   authentication  401, 403: the destination stops an hour, pino error, a human acts
//   permanent       any other 4xx: failed, visible, replayable
// Of an answer, the contact id is read and NOTHING else (05 RG85: no enriched data comes back
// into INFLUX). Nothing of a request or of Apollo's message reaches a log line or a cause: the
// HTTP status at most (D60, 05 RG99). Never imported by the HTTP process (apollo-guard.test.ts).
import type { CallResult } from "../../connector.ts";
import type { ApolloContactBody } from "./mapping.ts";

/** G1: bound of each call to Apollo, in milliseconds (the value of Brevo, 02 §18.4). */
export const APOLLO_CALL_TIMEOUT_MS = 3_000;
/** Authentication class: the destination stops for an hour, for a human to act. */
export const UNAUTHORIZED_STOP_SECONDS = 3_600;

const CONTACTS_PATH = "/contacts";
const CONTACT_ID = /^[A-Za-z0-9_-]{1,200}$/;

export type ApolloClientLogger = {
  error(object: object, message: string): void;
};

export type ApolloClient = {
  /**
   * The contact created (`run_dedupe`: never a duplicate) or, when its Apollo id is known, updated
   * by that id; an id Apollo no longer knows falls back to a create.
   */
  upsertContact(
    body: ApolloContactBody,
    knownContactId: string | null,
  ): Promise<CallResult>;
};

export type ApolloClientSettings = {
  apiKey: string;
  baseUrl: string;
};

export type ApolloClientDependencies = {
  logger: ApolloClientLogger;
  fetch?: typeof fetch;
  timeoutMs?: number;
};

type Answer =
  | { kind: "answer"; status: number; headers: Headers; body: unknown }
  | { kind: "transport" };

/** Seconds before the next window (Retry-After), or undefined. */
function retryAfterOf(headers: Headers): number | undefined {
  const value = headers.get("retry-after");
  return value !== null && /^[0-9]{1,6}$/.test(value.trim())
    ? Number(value.trim())
    : undefined;
}

/** RG85: the contact id, the only value read from an answer. */
function contactIdOf(body: unknown): string | null {
  if (typeof body !== "object" || body === null) {
    return null;
  }
  const contact = (body as { contact?: unknown }).contact;
  if (typeof contact !== "object" || contact === null) {
    return null;
  }
  const id = (contact as { id?: unknown }).id;
  return typeof id === "string" && CONTACT_ID.test(id) ? id : null;
}

export function createApolloClient(
  settings: ApolloClientSettings,
  dependencies: ApolloClientDependencies,
): ApolloClient {
  const doFetch = dependencies.fetch ?? fetch;
  const timeoutMs = dependencies.timeoutMs ?? APOLLO_CALL_TIMEOUT_MS;

  async function call(
    method: "POST" | "PUT",
    path: string,
    body: Record<string, unknown>,
  ): Promise<Answer> {
    let response: Response;
    let answerBody: unknown;
    try {
      response = await doFetch(`${settings.baseUrl}${path}`, {
        method,
        headers: {
          "x-api-key": settings.apiKey,
          accept: "application/json",
          "cache-control": "no-cache",
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
      const text = await response.text();
      try {
        answerBody = text.length > 0 ? JSON.parse(text) : undefined;
      } catch {
        // Not JSON: no id to read; the status is enough.
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

  /** The answer that is not a success, in its class. */
  function failureOf(answer: Answer): CallResult {
    if (answer.kind === "transport") {
      return {
        kind: "retry",
        errorCode: "apollo.unreachable",
        errorMessage: "Apollo did not answer in time",
      };
    }
    const { status } = answer;
    if (status === 429) {
      const retryAfterSeconds = retryAfterOf(answer.headers);
      return {
        kind: "retry",
        errorCode: "apollo.rate_limited",
        errorMessage: "Apollo answered 429",
        ...(retryAfterSeconds === undefined ? {} : { retryAfterSeconds }),
        rateLimited: true,
      };
    }
    if (status >= 500) {
      return {
        kind: "retry",
        errorCode: "apollo.unavailable",
        errorMessage: `Apollo answered ${status}`,
      };
    }
    if (status === 401 || status === 403) {
      // Skill: alert at once, stop the queue, a human acts. Its budget pauses an hour.
      dependencies.logger.error(
        { destination: "apollo_contact", statusCode: status },
        "leads.apollo.unauthorized",
      );
      return {
        kind: "retry",
        errorCode: "apollo.unauthorized",
        errorMessage: `Apollo answered ${status}`,
        retryAfterSeconds: UNAUTHORIZED_STOP_SECONDS,
        rateLimited: true,
      };
    }
    return {
      kind: "failed",
      errorCode: "apollo.rejected",
      errorMessage: `Apollo answered ${status}`,
    };
  }

  function succeeded(answer: Answer): CallResult | null {
    if (
      answer.kind !== "answer" ||
      answer.status < 200 ||
      answer.status > 201
    ) {
      return null;
    }
    const id = contactIdOf(answer.body);
    // A success without its id cannot be updated later: retried, run_dedupe keeps it single.
    return id === null
      ? {
          kind: "retry",
          errorCode: "apollo.no_contact_id",
          errorMessage: "Apollo accepted the contact without an id",
        }
      : { kind: "succeeded", providerContactId: id };
  }

  async function create(body: ApolloContactBody): Promise<CallResult> {
    const answer = await call("POST", CONTACTS_PATH, {
      ...body,
      run_dedupe: true,
    });
    return succeeded(answer) ?? failureOf(answer);
  }

  return {
    async upsertContact(body, knownContactId) {
      if (knownContactId === null) {
        return create(body);
      }
      const answer = await call(
        "PUT",
        `${CONTACTS_PATH}/${encodeURIComponent(knownContactId)}`,
        { ...body },
      );
      if (answer.kind === "answer" && answer.status === 404) {
        // Deleted on Apollo's side: created again, deduplicated by address.
        return create(body);
      }
      return succeeded(answer) ?? failureOf(answer);
    },
  };
}
