// The monitor of the worker when the base cannot be reached (02 §20.5, §20.9 "Base injoignable";
// 15 RG165): the probe still runs, AL49 is judged on the results kept in memory with its starting
// definition, the e-mails go directly to the sender, to the on-call addresses only, and the end
// of the incident is said. The base is a closed port of the loopback: every transaction fails at
// once. The real base is db-tests/tm9-monitoring-loop.
import { describe, expect, it } from "vitest";
import { createWorkerDatabase } from "../src/db/index.ts";
import { createWorkerMonitor } from "../src/domains/ops/worker-monitor.ts";
import type { TransactionalEmail } from "../src/platform/brevo-transactional.ts";

const ORIGINS = {
  web: "https://influx.example",
  backoffice: "https://bo.influx.example",
  api: "http://api.railway.internal:3100",
};

function unreachableDatabase() {
  return createWorkerDatabase(
    {
      worker: {
        url: "postgresql://influx_worker_login:x@127.0.0.1:1/postgres",
        role: "influx_worker_login",
        tls: false,
      },
    },
    { info: () => undefined, warn: () => undefined, error: () => undefined },
  );
}

describe("worker monitor without the base (02 §20.9)", () => {
  it("raises AL49 after two failures of /health, to the on-call addresses, then says it is over", async () => {
    let apiDown = true;
    const sent: TransactionalEmail[] = [];
    const lines: { message: string; object: object }[] = [];
    const logger = {
      info: (object: object, message: string) =>
        lines.push({ object, message }),
      warn: (object: object, message: string) =>
        lines.push({ object, message }),
    };
    let at = Date.parse("2026-10-22T08:00:00Z");
    const monitor = createWorkerMonitor({
      database: unreachableDatabase(),
      probe: ORIGINS,
      sender: {
        send: async (email) => {
          sent.push(email);
          return {
            status: "sent",
            messageId: `<${String(sent.length)}@brevo>`,
          };
        },
      },
      onCallRecipients: ["ops@influx.example"],
      instance: "test",
      logger,
      fetch: async (url) =>
        String(url).endsWith("/health") && apiDown
          ? new Response("", { status: 503 })
          : new Response("<html></html>", { status: 200 }),
      now: () => new Date(at),
      elapsed: () => 0,
      sleep: async () => undefined,
    });

    await monitor.tick();
    expect(sent).toEqual([]);
    at += 60_000;
    await monitor.tick();
    expect(sent.map((email) => [email.template, email.to])).toEqual([
      ["internal.technical_alert", "ops@influx.example"],
    ]);
    expect(sent[0]?.subject).toContain("AL49");
    expect(sent[0]?.text).toContain("/health");

    // Still down a minute later: no reminder before 30 minutes.
    at += 60_000;
    await monitor.tick();
    expect(sent).toHaveLength(1);

    apiDown = false;
    at += 60_000;
    await monitor.tick();
    expect(sent).toHaveLength(2);
    expect(sent[1]?.subject).toContain("rétabli");

    const unavailable = lines.filter(
      (line) => line.message === "ops.monitor.database_unavailable",
    );
    expect(unavailable).toHaveLength(1);
    expect(JSON.stringify(lines)).not.toContain("@");
    expect(JSON.stringify(lines)).not.toContain("railway.internal");
  });

  it("sends nothing without targets (development without the probe)", async () => {
    const sent: TransactionalEmail[] = [];
    const monitor = createWorkerMonitor({
      database: unreachableDatabase(),
      probe: null,
      sender: {
        send: async (email) => {
          sent.push(email);
          return { status: "sent", messageId: "<1@brevo>" };
        },
      },
      onCallRecipients: ["ops@influx.example"],
      instance: "test",
      logger: { info: () => undefined, warn: () => undefined },
      sleep: async () => undefined,
    });
    await monitor.tick();
    await monitor.tick();
    expect(sent).toEqual([]);
  });
});
