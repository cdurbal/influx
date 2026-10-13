// The Brevo double (docs/mvp/16 RG148, 21 J3-C rule 10): a fake Brevo on the LOOPBACK only, for
// the tests and for local development. No test ever reaches Brevo.
// - It answers, like Brevo and from the recorded exchanges of brevo-exchanges.ts, the operations
//   INFLUX uses (16 §M1): 1 `POST /v3/contacts` (`updateEnabled`), 2 `PUT /v3/contacts/{email}`,
//   6 the unitary transactional send `POST /v3/smtp/email`, 7 `POST /v3/contacts/lists/{id}/
//   contacts/add`, and the address change of J7 decision 5, `PUT /v3/contacts/{identifier}
//   ?identifierType=contact_id|email_id` with the attribute EMAIL (Brevo then lifts the
//   blacklist). It keeps the contacts and the lists it was given, and records every request.
// - What Brevo reports back (J7, commit 4): `webhookEvent()` gives the body Brevo would post to
//   the webhook for one of its contacts, from the exemplars of brevo-exchanges.ts; an unsubscription
//   or a complaint is first applied to the contact, as at Brevo (05 RG90: Brevo is right).
// - A transactional send carrying an `Idempotency-Key` already accepted is answered with the same
//   message id and is NOT delivered again (16 RG90, §M3): `messages` holds every send received,
//   `delivered` the e-mails that would have left.
// - A test may queue other answers (status, headers, body, delay, transport failure): they are
//   used in order by the next requests, whatever their path, and change nothing in the store.
// - Development: `pnpm dev:brevo-double` starts it and shows the messages received on a local
//   page. Only on 127.0.0.1, never 0.0.0.0: the page shows valid codes (security arbitration of
//   the J3, rule 10). Started only by the development and test scripts.
// - `GET /messages` gives the same messages as JSON, for a test that runs in another process
//   than the double (the Playwright journeys of the J5, commit 6).
import { randomUUID } from "node:crypto";
import { createServer, type IncomingHttpHeaders, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import {
  CONTACT_BLACKLISTED,
  CONTACT_CREATED,
  CONTACT_EMAIL_CHANGED,
  CONTACT_EMAIL_TAKEN,
  CONTACT_NOT_FOUND,
  CONTACT_UPDATED,
  INBOUND_EXEMPLARS,
  LIST_CONTACT_ADDED,
  LIST_CONTACT_ALREADY_IN,
  type InboundEventKind,
  type RecordedExchange,
} from "./brevo-exchanges.ts";

export const BREVO_DOUBLE_HOST = "127.0.0.1";

export type BrevoDoubleMessage = {
  path: string;
  headers: IncomingHttpHeaders;
  /** The JSON body as received. */
  body: {
    sender?: { name?: string; email?: string };
    to?: { email?: string }[];
    subject?: string;
    htmlContent?: string;
    textContent?: string;
    templateId?: number;
    params?: Record<string, unknown>;
    tags?: string[];
    [key: string]: unknown;
  };
  /** The raw body text, for searches by value. */
  raw: string;
  answeredStatus: number;
};

/** Any request received on the Brevo API, transactional or not. */
export type BrevoDoubleRequest = {
  method: string;
  path: string;
  headers: IncomingHttpHeaders;
  /** The parsed JSON body, or undefined. */
  body: unknown;
  raw: string;
  answeredStatus: number;
};

/** A contact as the double keeps it: the attributes received, merged. */
export type BrevoDoubleContact = {
  id: number;
  email: string;
  attributes: Record<string, unknown>;
  listIds: number[];
  emailBlacklisted: boolean;
};

/** What a webhook event names, besides the contact's address. */
export type BrevoDoubleEventDetails = {
  /** The message-id of a transactional e-mail (16 RG94). */
  messageId?: string;
  campaignId?: number;
  templateId?: number;
  /** Seconds since the epoch; now by default. */
  tsEvent?: number;
};

export type BrevoDoubleAnswer = {
  status: number;
  headers?: Record<string, string>;
  body?: unknown;
  delayMs?: number;
  /** Close the connection without answering (a transport failure). */
  destroy?: boolean;
};

export type BrevoDouble = {
  /** `http://127.0.0.1:<port>/v3`: the value of BREVO_API_BASE_URL. */
  baseUrl: string;
  /** Every transactional send received (`POST /v3/smtp/email`). */
  messages: BrevoDoubleMessage[];
  /** The transactional e-mails that would have left: one per Idempotency-Key. */
  delivered: BrevoDoubleMessage[];
  /** Every request received on the API, in order. */
  requests: BrevoDoubleRequest[];
  /** The contacts, by lower-case address. */
  contacts: Map<string, BrevoDoubleContact>;
  /** The members of each list, by list id. */
  lists: Map<number, Set<string>>;
  /** Answers used in order by the next requests, whatever their path; then the recorded ones. */
  queue(...answers: BrevoDoubleAnswer[]): void;
  /** Delay of every default answer, in milliseconds. */
  setDefaultDelay(delayMs: number): void;
  /**
   * The body Brevo would post to the webhook for this event of `email` (any address, known or
   * not). `unsubscribed` and `spam` first blacklist a known contact, as Brevo does.
   */
  webhookEvent(
    kind: InboundEventKind,
    email: string,
    details?: BrevoDoubleEventDetails,
  ): Record<string, unknown>;
  reset(): void;
  close(): Promise<void>;
};

const CONTACTS_PATH = "/v3/contacts";
const CONTACT_PATH =
  /^\/v3\/contacts\/([^/?]+)(?:\?identifierType=(contact_id|email_id))?$/;
const LIST_ADD_PATH = /^\/v3\/contacts\/lists\/([0-9]+)\/contacts\/add$/;
const SMTP_PATH = "/v3/smtp/email";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function page(messages: readonly BrevoDoubleMessage[]): string {
  const items = [...messages]
    .reverse()
    .map(
      (message) =>
        `<article><h2>${escapeHtml(message.body.to?.[0]?.email ?? "?")} — ${escapeHtml(
          message.body.subject ?? String(message.body.templateId ?? ""),
        )}</h2><pre>${escapeHtml(message.body.textContent ?? "")}</pre></article>`,
    )
    .join("\n");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Brevo double</title></head><body><h1>Brevo double (local only)</h1>${items || "<p>No message.</p>"}</body></html>`;
}

/** The recorded answer of an exchange, its body replaced when the double computes one. */
function recorded(
  exchange: RecordedExchange,
  body?: unknown,
): BrevoDoubleAnswer {
  const answer: BrevoDoubleAnswer = { status: exchange.response.status };
  if (exchange.response.headers !== undefined) {
    answer.headers = exchange.response.headers;
  }
  const answerBody = body ?? exchange.response.body;
  if (answerBody !== undefined) {
    answer.body = answerBody;
  }
  return answer;
}

function objectOf(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function numbersOf(value: unknown): number[] {
  return Array.isArray(value)
    ? value.filter((item): item is number => typeof item === "number")
    : [];
}

export async function startBrevoDouble(port = 0): Promise<BrevoDouble> {
  const messages: BrevoDoubleMessage[] = [];
  const delivered: BrevoDoubleMessage[] = [];
  const requests: BrevoDoubleRequest[] = [];
  const contacts = new Map<string, BrevoDoubleContact>();
  const lists = new Map<number, Set<string>>();
  const sentByKey = new Map<string, string>();
  const pending: BrevoDoubleAnswer[] = [];
  let defaultDelayMs = 0;
  let nextContactId = 1;

  /** Operation 1: created (201 and its id), or updated with updateEnabled (204, no body). */
  function upsertContact(body: Record<string, unknown>): BrevoDoubleAnswer {
    const email =
      typeof body.email === "string" ? body.email.toLowerCase() : "";
    const attributes = objectOf(body.attributes);
    const listIds = numbersOf(body.listIds);
    const existing = contacts.get(email);
    if (existing !== undefined) {
      if (body.updateEnabled !== true) {
        return {
          status: 400,
          body: {
            code: "duplicate_parameter",
            message: "Contact already exist",
          },
        };
      }
      Object.assign(existing.attributes, attributes);
      existing.listIds = [...new Set([...existing.listIds, ...listIds])];
      if (typeof body.emailBlacklisted === "boolean") {
        existing.emailBlacklisted = body.emailBlacklisted;
      }
      return recorded(CONTACT_UPDATED);
    }
    const id = nextContactId++;
    contacts.set(email, {
      id,
      email,
      attributes: { ...attributes },
      listIds,
      emailBlacklisted: body.emailBlacklisted === true,
    });
    return recorded(CONTACT_CREATED, { id });
  }

  function contactOf(
    identifier: string,
    type: string | undefined,
  ): BrevoDoubleContact | undefined {
    const value = decodeURIComponent(identifier);
    if (type === "contact_id") {
      return [...contacts.values()].find(
        (contact) => String(contact.id) === value,
      );
    }
    return contacts.get(value.toLowerCase());
  }

  /** The attribute EMAIL moves the contact, its lists with it; Brevo lifts the blacklist. */
  function moveContact(
    contact: BrevoDoubleContact,
    newEmail: string,
  ): BrevoDoubleAnswer {
    const target = newEmail.toLowerCase();
    if (target !== contact.email && contacts.has(target)) {
      return recorded(CONTACT_EMAIL_TAKEN);
    }
    contacts.delete(contact.email);
    for (const members of lists.values()) {
      if (members.delete(contact.email)) {
        members.add(target);
      }
    }
    contact.email = target;
    contact.emailBlacklisted = false;
    contacts.set(target, contact);
    return recorded(CONTACT_EMAIL_CHANGED);
  }

  /** Operation 2, or the address change: a known contact updated (204), an unknown one 404. */
  function updateContact(
    identifier: string,
    type: string | undefined,
    body: Record<string, unknown>,
  ): BrevoDoubleAnswer {
    const contact = contactOf(identifier, type);
    if (contact === undefined) {
      return recorded(CONTACT_NOT_FOUND);
    }
    const { EMAIL: newEmail, ...attributes } = objectOf(body.attributes);
    if (typeof newEmail === "string") {
      const moved = moveContact(contact, newEmail);
      if (moved.status !== 204) {
        return moved;
      }
    }
    Object.assign(contact.attributes, attributes);
    if (typeof body.emailBlacklisted === "boolean") {
      contact.emailBlacklisted = body.emailBlacklisted;
    }
    return recorded(CONTACT_BLACKLISTED);
  }

  function webhookEvent(
    kind: InboundEventKind,
    email: string,
    details: BrevoDoubleEventDetails = {},
  ): Record<string, unknown> {
    const known = contacts.get(email.toLowerCase());
    if (known !== undefined && (kind === "unsubscribed" || kind === "spam")) {
      known.emailBlacklisted = true;
    }
    const tsEvent = details.tsEvent ?? Math.floor(Date.now() / 1000);
    const body: Record<string, unknown> = {
      ...INBOUND_EXEMPLARS[kind],
      email,
      ts_event: tsEvent,
    };
    if ("ts" in body) {
      body.ts = tsEvent;
    }
    if ("ts_epoch" in body) {
      body.ts_epoch = tsEvent * 1000;
    }
    if (details.messageId !== undefined) {
      body["message-id"] = details.messageId;
    }
    if (details.campaignId !== undefined) {
      body.camp_id = details.campaignId;
    }
    if (details.templateId !== undefined) {
      body.template_id = details.templateId;
    }
    return body;
  }

  /** Operation 7: the known contacts not yet in the list are added; none added is a 400. */
  function addToList(
    listId: number,
    body: Record<string, unknown>,
  ): BrevoDoubleAnswer {
    const members = lists.get(listId) ?? new Set<string>();
    lists.set(listId, members);
    const success: string[] = [];
    const failure: string[] = [];
    for (const raw of Array.isArray(body.emails) ? body.emails : []) {
      const email = typeof raw === "string" ? raw.toLowerCase() : "";
      if (contacts.has(email) && !members.has(email)) {
        members.add(email);
        success.push(email);
      } else {
        failure.push(email);
      }
    }
    if (success.length === 0) {
      return recorded(LIST_CONTACT_ALREADY_IN);
    }
    return recorded(LIST_CONTACT_ADDED, { contacts: { success, failure } });
  }

  function answerOf(
    method: string,
    path: string,
    body: Record<string, unknown>,
    headers: IncomingHttpHeaders,
  ): BrevoDoubleAnswer | null {
    if (method === "POST" && path === SMTP_PATH) {
      const key = headers["idempotency-key"];
      const known = typeof key === "string" ? sentByKey.get(key) : undefined;
      return {
        status: 201,
        body: { messageId: known ?? `<${randomUUID()}@double.brevo.test>` },
      };
    }
    if (method === "POST" && path === CONTACTS_PATH) {
      return upsertContact(body);
    }
    const contact = CONTACT_PATH.exec(path);
    if (method === "PUT" && contact?.[1] !== undefined) {
      return updateContact(contact[1], contact[2], body);
    }
    const list = LIST_ADD_PATH.exec(path);
    if (method === "POST" && list?.[1] !== undefined) {
      return addToList(Number(list[1]), body);
    }
    return null;
  }

  /** Keeps a transactional send; delivered once per Idempotency-Key (16 RG90). */
  function recordSend(
    message: BrevoDoubleMessage,
    answer: BrevoDoubleAnswer,
  ): void {
    messages.push(message);
    if (answer.status !== 201 || answer.destroy === true) {
      return;
    }
    const key = message.headers["idempotency-key"];
    if (typeof key !== "string" || !sentByKey.has(key)) {
      delivered.push(message);
    }
    const messageId = objectOf(answer.body).messageId;
    if (typeof key === "string" && typeof messageId === "string") {
      sentByKey.set(key, messageId);
    }
  }

  const server: Server = createServer((request, response) => {
    let raw = "";
    request.on("data", (chunk: Buffer) => {
      raw += chunk.toString("utf8");
    });
    request.on("end", () => {
      const method = request.method ?? "GET";
      const path = request.url ?? "/";
      if (method === "GET" && path === "/") {
        response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        response.end(page(messages));
        return;
      }
      if (method === "GET" && path === "/messages") {
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify(messages.map(({ body }) => body)));
        return;
      }
      let parsed: unknown;
      try {
        parsed = raw.length > 0 ? JSON.parse(raw) : undefined;
      } catch {
        // Recorded as received; the sender under test is expected to send JSON.
      }
      const body = objectOf(parsed);
      const queued = pending.shift();
      const answer = queued ??
        answerOf(method, path, body, request.headers) ?? {
          status: 404,
          body: { code: "not_found", message: "double" },
        };
      const answeredStatus = answer.destroy === true ? 0 : answer.status;
      requests.push({
        method,
        path,
        headers: request.headers,
        body: parsed,
        raw,
        answeredStatus,
      });
      if (method === "POST" && path === SMTP_PATH) {
        recordSend(
          {
            path,
            headers: request.headers,
            body: body as BrevoDoubleMessage["body"],
            raw,
            answeredStatus,
          },
          answer,
        );
      }
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
          if (answer.status === 204) {
            response.end();
            return;
          }
          response.end(
            JSON.stringify(
              answer.body ??
                (answer.status === 201
                  ? { messageId: `<${randomUUID()}@double.brevo.test>` }
                  : { code: "internal", message: "double" }),
            ),
          );
        },
        answer.delayMs ?? (queued === undefined ? defaultDelayMs : 0),
      );
    });
  });
  await new Promise<void>((resolve) => {
    server.listen(port, BREVO_DOUBLE_HOST, resolve);
  });
  const { port: bound } = server.address() as AddressInfo;
  return {
    baseUrl: `http://${BREVO_DOUBLE_HOST}:${bound}/v3`,
    messages,
    delivered,
    requests,
    contacts,
    lists,
    queue(...answers) {
      pending.push(...answers);
    },
    setDefaultDelay(delayMs) {
      defaultDelayMs = delayMs;
    },
    webhookEvent,
    reset() {
      messages.length = 0;
      delivered.length = 0;
      requests.length = 0;
      contacts.clear();
      lists.clear();
      sentByKey.clear();
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
