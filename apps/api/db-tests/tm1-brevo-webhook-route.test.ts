// TM1 (J7, commit 3) — POST /v1/webhooks/brevo/:pathToken on the local stack (16 RG146, RG147,
// RG148 scenario 8; decisions 1 and 2 of the J7 start; D60). Real database, under influx_auth (E-1,
// leads.record_brevo_event()): one raw line, one elevated.leads.receive_brevo_event line, then the
// identical replay ignored without a second line of either kind. What is decided before the write
// (refusals, window, invalid bodies) is tests/brevo-webhook.test.ts. No call to Brevo (RG148).
// The lines are COMMITTED by the route (no transaction to roll back across an HTTP call). The
// processing of tm1-brevo-inbound takes "the oldest line without an outcome": every line written
// here is drained afterwards through that very processing, as influx_worker, with addresses that
// match no account (outcome unmatched, address set to NULL). Files run one after the other.
import { localRoleUrl, type LoginRole } from "@influx/test-kit/db";
import { valuesFoundIn } from "@influx/test-kit/logs";
import { randomUUID } from "node:crypto";
import type postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  closeDatabase,
  createApiDatabase,
  type ApiDatabase,
} from "../src/db/index.ts";
import { buildServer } from "../src/server.ts";
import { captureLogs, testApiConfig, WEB_SECRET } from "../tests/helpers.ts";
import {
  actAs,
  localSuperuser,
  migrationRole,
  testDataSet,
} from "./support.ts";

const PATH_TOKEN = "Ab3-_x9QzR7kLmN2pV8wYt4uHc6eJf1oGs5iDn0aB_c";
const HEADER_TOKEN = "hT5-header-token-current-0123456789abcdefgh";
const BREVO_ADDRESS = "172.246.240.33";

let database: ApiDatabase;
let migration: postgres.Sql;

function localConnection(role: LoginRole) {
  return { url: localRoleUrl(role), role, tls: false };
}

/** Processes every waiting raw line as influx_worker (E-3), committed: the stack is left clean. */
async function drainInboundLines(): Promise<number> {
  return localSuperuser().begin(async (tx) => {
    let processed = 0;
    for (;;) {
      const row = await actAs(tx, "worker", async () => {
        const [line] = await tx<{ id: string }[]>`
          select inbound_event_id::text as id from leads.process_brevo_inbound_event()`;
        return line;
      });
      if (row === undefined) {
        return processed;
      }
      processed += 1;
    }
  });
}

beforeAll(async () => {
  migration = migrationRole();
  await testDataSet();
  await drainInboundLines();
  database = createApiDatabase(
    {
      app: localConnection("influx_app"),
      auth: localConnection("influx_auth_login"),
      ops: localConnection("influx_ops_login"),
    },
    { info: () => undefined, warn: () => undefined, error: () => undefined },
  );
});

afterAll(async () => {
  await drainInboundLines();
  await closeDatabase(database);
});

function app() {
  const logs = captureLogs();
  const server = buildServer(
    {
      ...testApiConfig(),
      brevoWebhook: { pathTokens: [PATH_TOKEN], headerTokens: [HEADER_TOKEN] },
    },
    { logDestination: logs.destination, database },
  );
  return { server, logs };
}

type Server = ReturnType<typeof app>["server"];

/** A transactional event of Brevo, with values that no log line may hold (D60). */
function brevoEvent(marker: string, overrides: Record<string, unknown> = {}) {
  const now = Math.floor(Date.now() / 1000);
  return {
    event: "hard_bounce",
    email: `Tm1-Webhook-${marker}@Example.test`,
    id: 987654,
    date: "2026-10-13 14:00:00",
    ts: now,
    ts_event: now,
    ts_epoch: now * 1000,
    "message-id": `<${marker}@smtp-relay.mailin.fr>`,
    subject: `subject-${marker}`,
    link: `https://link-${marker}.example/`,
    sending_ip: "185.41.28.109",
    template_id: 41,
    reason: `reason-${marker}: user unknown`,
    ...overrides,
  };
}

function receive(server: Server, body: unknown) {
  return server.inject({
    method: "POST",
    url: `/v1/webhooks/brevo/${PATH_TOKEN}`,
    headers: {
      "x-influx-internal": WEB_SECRET,
      "content-type": "application/json",
      "x-real-ip": BREVO_ADDRESS,
      "brevo-webhook-token": HEADER_TOKEN,
    },
    payload: JSON.stringify(body),
  });
}

type RawLine = {
  id: string;
  origin: string;
  event: string;
  occurred_at: Date;
  provider_message_id: string | null;
  email: string | null;
  campaign_id: string | null;
  template_id: string | null;
  reason: string | null;
};

/** The raw lines of a message-id, and the audit lines written on them, read by the migration role. */
async function writtenFor(messageId: string) {
  const lines = await migration<RawLine[]>`
    select id::text, origin::text, event, occurred_at, provider_message_id, email,
           campaign_id::text, template_id::text, reason
      from leads.brevo_inbound_events where provider_message_id = ${messageId}
     order by received_at`;
  const audits = await migration<{ subject_id: string; actor_type: string }[]>`
    select subject_id::text, actor_type::text from audit.audit_events
     where event_type = 'elevated.leads.receive_brevo_event'
       and subject_id::text in ${migration(lines.length === 0 ? [randomUUID()] : lines.map((line) => line.id))}`;
  return { lines, audits };
}

function messages(
  logs: ReturnType<typeof captureLogs>,
): { msg: string; reason?: string }[] {
  return logs
    .lines()
    .map((line) => JSON.parse(line) as { msg: string; reason?: string });
}

describe("POST /v1/webhooks/brevo/:pathToken: the raw line, written by E-1 (RG147, decision 2)", () => {
  it("writes one minimal line and one audit line, and answers 200 at once", async () => {
    const { server, logs } = app();
    const marker = randomUUID();
    const body = brevoEvent(marker);
    try {
      const response = await receive(server, body);
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ received: true });

      const { lines, audits } = await writtenFor(body["message-id"]);
      expect(lines).toHaveLength(1);
      const [line] = lines;
      expect(line).toMatchObject({
        origin: "webhook",
        event: "hard_bounce",
        provider_message_id: body["message-id"],
        // Lower-cased by the database; nulled when the outcome is written (commit 4).
        email: body.email.toLowerCase(),
        campaign_id: null,
        template_id: "41",
        reason: `reason-${marker}: user unknown`,
      });
      expect(line?.occurred_at.getTime()).toBe(body.ts_event * 1000);
      // Decision 1: one register line per effective change, actor derived from session_user.
      expect(audits).toEqual([{ subject_id: line?.id, actor_type: "system" }]);

      // D60: nothing of the event, of the tokens or of the address in any log line.
      expect(
        valuesFoundIn(logs.text(), [
          body.email,
          body["message-id"],
          marker,
          PATH_TOKEN,
          HEADER_TOKEN,
          BREVO_ADDRESS,
        ]),
      ).toEqual([]);
    } finally {
      await server.close();
    }
  });

  it("ignores the identical replay: 200, no second line, no second audit line (scenario 8, RG146-5)", async () => {
    const { server, logs } = app();
    const body = brevoEvent(randomUUID(), {
      event: "unsubscribed",
      template_id: 0,
    });
    try {
      const first = await receive(server, body);
      const replay = await receive(server, body);
      expect(first.statusCode).toBe(200);
      expect(replay.statusCode).toBe(200);
      expect(replay.json()).toEqual({ received: true });
      const { lines, audits } = await writtenFor(body["message-id"]);
      expect(lines).toHaveLength(1);
      expect(lines[0]?.template_id).toBeNull();
      expect(audits).toHaveLength(1);
      expect(
        messages(logs).filter((line) => line.msg === "webhook.brevo.ignored"),
      ).toEqual([expect.objectContaining({ reason: "duplicate" })]);
    } finally {
      await server.close();
    }
  });

  it("records another event of the same message as a line of its own (the key holds the event)", async () => {
    const { server } = app();
    const body = brevoEvent(randomUUID(), { event: "delivered" });
    try {
      await receive(server, body);
      await receive(server, { ...body, event: "spam" });
      const { lines, audits } = await writtenFor(body["message-id"]);
      expect(lines.map((line) => line.event).sort()).toEqual([
        "delivered",
        "spam",
      ]);
      expect(audits).toHaveLength(2);
    } finally {
      await server.close();
    }
  });

  it("answers 200 without writing a value the database refuses (22023): invalid, never retried", async () => {
    const { server, logs } = app();
    // A control character passes the shape of the contract, not the check of the database.
    const body = brevoEvent(randomUUID(), {
      email: `tm1-webhook-${randomUUID()}\u0001@example.test`,
    });
    try {
      const response = await receive(server, body);
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ received: true });
      expect((await writtenFor(body["message-id"])).lines).toEqual([]);
      expect(
        messages(logs).filter((line) => line.msg === "webhook.brevo.ignored"),
      ).toEqual([expect.objectContaining({ reason: "invalid_payload" })]);
    } finally {
      await server.close();
    }
  });
});
