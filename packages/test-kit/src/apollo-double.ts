// The Apollo double (docs/mvp/16 RG148, skill apollo-lead-sync "Tests"): a fake Apollo on the
// LOOPBACK only, for the tests and for local development. No test ever reaches Apollo.
// - It answers, like Apollo and from the exchanges of apollo-exchanges.ts, the two operations
//   INFLUX uses: create `POST /api/v1/contacts` (with `run_dedupe`: an address already known gives
//   back the same contact, never a duplicate) and update `PUT /api/v1/contacts/{id}`. Every answer
//   carries Apollo's own enriched fields (ENRICHED_FIELDS), which INFLUX must never read back (05
//   RG85). It keeps the contacts it was given and records every request.
// - Nothing else exists here: no sequence, no mailbox, no enrichment call. A request on any other
//   path is answered 404 and recorded, so that a test sees it.
// - A test may queue other answers (status, headers, body, delay, transport failure): they are
//   used in order by the next requests, whatever their path, and change nothing in the store.
// Only on 127.0.0.1, never 0.0.0.0.
import { createServer, type IncomingHttpHeaders, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import {
  CONTACT_CREATED,
  CONTACT_NOT_FOUND,
  CONTACT_UPDATED,
  ENRICHED_FIELDS,
  type RecordedExchange,
} from "./apollo-exchanges.ts";

export const APOLLO_DOUBLE_HOST = "127.0.0.1";

/** Any request received, in order. */
export type ApolloDoubleRequest = {
  method: string;
  path: string;
  headers: IncomingHttpHeaders;
  /** The parsed JSON body, or undefined. */
  body: unknown;
  raw: string;
  answeredStatus: number;
};

/** A contact as the double keeps it: the fields received, merged. */
export type ApolloDoubleContact = {
  id: string;
  email: string;
  fields: Record<string, unknown>;
};

export type ApolloDoubleAnswer = {
  status: number;
  headers?: Record<string, string>;
  body?: unknown;
  delayMs?: number;
  /** Close the connection without answering (a transport failure). */
  destroy?: boolean;
};

export type ApolloDouble = {
  /** `http://127.0.0.1:<port>/api/v1`: the value of APOLLO_API_BASE_URL. */
  baseUrl: string;
  /** Every request received, in order. */
  requests: ApolloDoubleRequest[];
  /** The contacts, by id. */
  contacts: Map<string, ApolloDoubleContact>;
  /** Answers used in order by the next requests, whatever their path; then the recorded ones. */
  queue(...answers: ApolloDoubleAnswer[]): void;
  /** Delay of every default answer, in milliseconds. */
  setDefaultDelay(delayMs: number): void;
  reset(): void;
  close(): Promise<void>;
};

const CONTACTS_PATH = "/api/v1/contacts";
const CONTACT_PATH = /^\/api\/v1\/contacts\/([^/?]+)$/;

function objectOf(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** The recorded answer of an exchange, for this contact. */
function recorded(
  exchange: RecordedExchange,
  contact?: ApolloDoubleContact,
): ApolloDoubleAnswer {
  const answer: ApolloDoubleAnswer = { status: exchange.response.status };
  if (exchange.response.headers !== undefined) {
    answer.headers = exchange.response.headers;
  }
  answer.body =
    contact === undefined
      ? exchange.response.body
      : {
          contact: {
            ...ENRICHED_FIELDS,
            ...contact.fields,
            id: contact.id,
            email: contact.email,
          },
        };
  return answer;
}

export async function startApolloDouble(port = 0): Promise<ApolloDouble> {
  const requests: ApolloDoubleRequest[] = [];
  const contacts = new Map<string, ApolloDoubleContact>();
  const pending: ApolloDoubleAnswer[] = [];
  let defaultDelayMs = 0;
  let nextContactId = 1;

  function newId(): string {
    return `65f0c0ffee${String(nextContactId++).padStart(14, "0")}`;
  }

  /** Create; with run_dedupe, an address already known gives back the same contact. */
  function createContact(body: Record<string, unknown>): ApolloDoubleAnswer {
    const email =
      typeof body.email === "string" ? body.email.toLowerCase() : "";
    const { run_dedupe: dedupe, ...fields } = body;
    if (dedupe === true) {
      const known = [...contacts.values()].find(
        (contact) => contact.email === email,
      );
      if (known !== undefined) {
        Object.assign(known.fields, fields);
        return recorded(CONTACT_CREATED, known);
      }
    }
    const contact = { id: newId(), email, fields: { ...fields } };
    contacts.set(contact.id, contact);
    return recorded(CONTACT_CREATED, contact);
  }

  function updateContact(
    id: string,
    body: Record<string, unknown>,
  ): ApolloDoubleAnswer {
    const contact = contacts.get(decodeURIComponent(id));
    if (contact === undefined) {
      return recorded(CONTACT_NOT_FOUND);
    }
    Object.assign(contact.fields, body);
    return recorded(CONTACT_UPDATED, contact);
  }

  function answerOf(
    method: string,
    path: string,
    body: Record<string, unknown>,
  ): ApolloDoubleAnswer | null {
    if (method === "POST" && path === CONTACTS_PATH) {
      return createContact(body);
    }
    const contact = CONTACT_PATH.exec(path);
    if (method === "PUT" && contact?.[1] !== undefined) {
      return updateContact(contact[1], body);
    }
    return null;
  }

  const server: Server = createServer((request, response) => {
    let raw = "";
    request.on("data", (chunk: Buffer) => {
      raw += chunk.toString("utf8");
    });
    request.on("end", () => {
      const method = request.method ?? "GET";
      const path = request.url ?? "/";
      let parsed: unknown;
      try {
        parsed = raw.length > 0 ? JSON.parse(raw) : undefined;
      } catch {
        // Recorded as received; the caller under test is expected to send JSON.
      }
      const queued = pending.shift();
      const answer = queued ??
        answerOf(method, path, objectOf(parsed)) ?? {
          status: 404,
          body: { error: "double: no such path" },
        };
      requests.push({
        method,
        path,
        headers: request.headers,
        body: parsed,
        raw,
        answeredStatus: answer.destroy === true ? 0 : answer.status,
      });
      setTimeout(
        () => {
          if (answer.destroy === true) {
            request.socket.destroy();
            return;
          }
          response.writeHead(answer.status, {
            "content-type": "application/json",
            ...answer.headers,
          });
          response.end(
            JSON.stringify(answer.body ?? { error: "double: internal" }),
          );
        },
        answer.delayMs ?? (queued === undefined ? defaultDelayMs : 0),
      );
    });
  });
  await new Promise<void>((resolve) => {
    server.listen(port, APOLLO_DOUBLE_HOST, resolve);
  });
  const { port: bound } = server.address() as AddressInfo;
  return {
    baseUrl: `http://${APOLLO_DOUBLE_HOST}:${bound}/api/v1`,
    requests,
    contacts,
    queue(...answers) {
      pending.push(...answers);
    },
    setDefaultDelay(delayMs) {
      defaultDelayMs = delayMs;
    },
    reset() {
      requests.length = 0;
      contacts.clear();
      pending.length = 0;
      defaultDelayMs = 0;
      nextContactId = 1;
    },
    close() {
      return new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      });
    },
  };
}
