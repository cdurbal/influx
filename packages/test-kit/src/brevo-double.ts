// The Brevo double (docs/mvp/16 RG148, 21 J3-C rule 10): a fake Brevo on the LOOPBACK only, for
// the tests and for local development. No test ever reaches Brevo.
// - It answers the unitary transactional send `POST /v3/smtp/email` like Brevo (201 and a
//   message id), and records what it received; a test may queue other answers (status, delay).
// - Development: `pnpm dev:brevo-double` starts it and shows the messages received on a local
//   page. Only on 127.0.0.1, never 0.0.0.0: the page shows valid codes (security arbitration of
//   the J3, rule 10). Started only by the development and test scripts.
import { randomUUID } from "node:crypto";
import { createServer, type IncomingHttpHeaders, type Server } from "node:http";
import type { AddressInfo } from "node:net";

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
    tags?: string[];
    [key: string]: unknown;
  };
  /** The raw body text, for searches by value. */
  raw: string;
  answeredStatus: number;
};

export type BrevoDoubleAnswer = {
  status: number;
  body?: unknown;
  delayMs?: number;
  /** Close the connection without answering (a transport failure). */
  destroy?: boolean;
};

export type BrevoDouble = {
  /** `http://127.0.0.1:<port>/v3`: the value of BREVO_API_BASE_URL. */
  baseUrl: string;
  messages: BrevoDoubleMessage[];
  /** Answers used in order by the next sends; then the default 201. */
  queue(...answers: BrevoDoubleAnswer[]): void;
  /** Delay of every default answer, in milliseconds. */
  setDefaultDelay(delayMs: number): void;
  reset(): void;
  close(): Promise<void>;
};

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
          message.body.subject ?? "",
        )}</h2><pre>${escapeHtml(message.body.textContent ?? "")}</pre></article>`,
    )
    .join("\n");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Brevo double</title></head><body><h1>Brevo double (local only)</h1>${items || "<p>No message.</p>"}</body></html>`;
}

export async function startBrevoDouble(port = 0): Promise<BrevoDouble> {
  const messages: BrevoDoubleMessage[] = [];
  const pending: BrevoDoubleAnswer[] = [];
  let defaultDelayMs = 0;

  const server: Server = createServer((request, response) => {
    let raw = "";
    request.on("data", (chunk: Buffer) => {
      raw += chunk.toString("utf8");
    });
    request.on("end", () => {
      if (request.method === "GET" && request.url === "/") {
        response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        response.end(page(messages));
        return;
      }
      if (request.method !== "POST" || request.url !== "/v3/smtp/email") {
        response.writeHead(404, { "content-type": "application/json" });
        response.end(JSON.stringify({ code: "not_found", message: "double" }));
        return;
      }
      const answer = pending.shift() ?? {
        status: 201,
        delayMs: defaultDelayMs,
      };
      let body: BrevoDoubleMessage["body"] = {};
      try {
        body = JSON.parse(raw) as BrevoDoubleMessage["body"];
      } catch {
        // Recorded as received; the sender under test is expected to send JSON.
      }
      messages.push({
        path: request.url,
        headers: request.headers,
        body,
        raw,
        answeredStatus: answer.destroy === true ? 0 : answer.status,
      });
      setTimeout(() => {
        if (answer.destroy === true) {
          request.socket.destroy();
          return;
        }
        response.writeHead(answer.status, {
          "content-type": "application/json",
        });
        response.end(
          JSON.stringify(
            answer.body ??
              (answer.status === 201
                ? { messageId: `<${randomUUID()}@double.brevo.test>` }
                : { code: "internal", message: "double" }),
          ),
        );
      }, answer.delayMs ?? 0);
    });
  });
  await new Promise<void>((resolve) => {
    server.listen(port, BREVO_DOUBLE_HOST, resolve);
  });
  const { port: bound } = server.address() as AddressInfo;
  return {
    baseUrl: `http://${BREVO_DOUBLE_HOST}:${bound}/v3`,
    messages,
    queue(...answers) {
      pending.push(...answers);
    },
    setDefaultDelay(delayMs) {
      defaultDelayMs = delayMs;
    },
    reset() {
      messages.length = 0;
      pending.length = 0;
      defaultDelayMs = 0;
    },
    close() {
      return new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      });
    },
  };
}
