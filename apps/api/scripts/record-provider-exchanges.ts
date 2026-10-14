// The manual trial of J6 commit 7 (docs/mvp/16 RG115, RG148; D62), run by the founder on the
// workstation only, with the TEST accounts of Brevo and Apollo. Never in CI, never on Railway.
//
//   pnpm trial:record worker   the real worker drains the local queue; its exchanges are recorded
//   pnpm trial:record probes   the answers the worker alone does not meet (update, 404, 400, 401)
//   pnpm trial:record reconciliation   the two reads of the daily reconciliation, once each (J7 c10)
//   pnpm trial:record inbound [--port=N] [--minutes=30] [--max-bodies=20]
//                              the bodies Brevo posts to a webhook, through a quick tunnel (J7 c10)
//   pnpm trial:record redact   the raw recordings, redacted, for the fixtures of packages/test-kit
//
// The raw recordings (addresses and ids of the test accounts) stay in .provider-recordings/,
// ignored by Git; only redacted.json is read to write the fixtures, then raw.jsonl is deleted by
// hand (the instruction is printed by `redact`).
import { randomUUID } from "node:crypto";
import { appendFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { loadWorkerConfig } from "../src/config/index.ts";
import { createApolloClient } from "../src/domains/leads/connectors/apollo/client.ts";
import { createBrevoClient } from "../src/domains/leads/connectors/brevo/client.ts";
import {
  INBOUND_HOST,
  parseInboundArguments,
  startInboundRecorder,
} from "./inbound-recording.ts";
import { recordingFetch, redactFile } from "./provider-recording.ts";
import { readReconciliationOnce } from "./reconciliation-reads.ts";
import { refuseProduction, requiredShellVariable } from "./script-guards.ts";

const WHAT = "provider exchange recording";
const DIRECTORY = path.join(import.meta.dirname, "..", ".provider-recordings");
const RAW = path.join(DIRECTORY, "raw.jsonl");
const REDACTED = path.join(DIRECTORY, "redacted.json");
const LOOPBACK = new Set(["127.0.0.1", "localhost", "[::1]"]);

/** D62: the workstation, its local database, and never `live` (16 RG115 point 2). */
function refuseOutsideTheWorkstation(): void {
  refuseProduction(WHAT);
  if (
    process.env.RAILWAY_ENVIRONMENT !== undefined ||
    process.env.CI !== undefined
  ) {
    throw new Error(`${WHAT} refused on Railway and in CI (16 RG115 point 4)`);
  }
  const database = process.env.WORKER_DATABASE_URL;
  if (database === undefined || !LOOPBACK.has(new URL(database).hostname)) {
    throw new Error(
      `${WHAT} refused: WORKER_DATABASE_URL must be the local stack (D62)`,
    );
  }
  if (process.env.BREVO_MODE !== "redirect") {
    throw new Error(
      `${WHAT} refused: BREVO_MODE must be redirect (16 RG115 point 2)`,
    );
  }
}

function installRecorder(): void {
  mkdirSync(DIRECTORY, { recursive: true });
  globalThis.fetch = recordingFetch(
    globalThis.fetch.bind(globalThis),
    (record) => {
      appendFileSync(RAW, `${JSON.stringify(record)}\n`);
      // The operator sees what happened, never a body.
      process.stdout.write(
        `${record.provider} ${record.method} ${record.status}\n`,
      );
    },
  );
}

const logger = {
  error(_object: object, message: string): void {
    process.stderr.write(`${message}\n`);
  },
};

/** One call per answer the double must know and the worker alone does not meet. */
async function probes(): Promise<void> {
  const persona = requiredShellVariable("INFLUX_TRIAL_PERSONA_EMAIL");
  const unknown = persona.replace(
    /^[^@]+/,
    `unknown-${randomUUID().slice(0, 8)}`,
  );
  const config = loadWorkerConfig();
  const brevoKey = config.brevoTransport.apiKey;
  const apolloKey = config.apollo.apiKey;
  if (brevoKey === null || apolloKey === null) {
    throw new Error(
      "BREVO_API_KEY and APOLLO_API_KEY of the test accounts are required",
    );
  }
  const brevo = createBrevoClient(
    {
      apiKey: brevoKey,
      baseUrl: config.brevoTransport.baseUrl,
      destination: "brevo_contact",
    },
    { logger },
  );
  const contact = {
    email: persona,
    // 16 §M4 sends "" for an empty field, dates included: does Brevo accept it on a date attribute?
    attributes: {
      INFLUX_ACCOUNT_ID: randomUUID(),
      LANGUAGE: "fr",
      SIGNED_UP_AT: "",
    },
    listIds: [],
    updateEnabled: true,
  };
  await brevo.upsertContact(contact); // 201, or 204 if the persona is already known
  await brevo.upsertContact(contact); // 204
  const listId = config.brevoTransport.suppressionListId;
  await brevo.unsubscribeContact(persona, { emailBlacklisted: true }, listId); // 204, then 201
  await brevo.unsubscribeContact(persona, { emailBlacklisted: true }, listId); // 204, then 400?
  await brevo.unsubscribeContact(unknown, { emailBlacklisted: true }, listId); // 404
  await createBrevoClient(
    {
      apiKey: "influx-trial-refused-key",
      baseUrl: config.brevoTransport.baseUrl,
      destination: "brevo_contact",
    },
    { logger },
  ).upsertContact(contact); // 401

  const apollo = createApolloClient(
    { apiKey: apolloKey, baseUrl: config.apollo.baseUrl },
    { logger },
  );
  const body = {
    email: persona,
    label_names: ["influx", "influx_profile_creator"],
    run_dedupe: true as const,
  };
  const created = await apollo.upsertContact(body, null); // create
  const id =
    created.kind === "succeeded" ? (created.providerContactId ?? null) : null;
  if (id !== null) {
    await apollo.upsertContact({ email: persona, label_names: ["influx"] }, id); // update: PUT?
  }
  await apollo.upsertContact(body, "65f0c0ffee0000000000dead"); // 404, then create
  await createApolloClient(
    { apiKey: "influx-trial-refused-key", baseUrl: config.apollo.baseUrl },
    { logger },
  ).upsertContact(body, null); // 401
}

/** Operations 9 and 10 once each, through the client of E-4; no database is opened. */
async function reconciliation(): Promise<void> {
  const config = loadWorkerConfig();
  const apiKey = config.brevoTransport.apiKey;
  if (apiKey === null) {
    throw new Error("BREVO_API_KEY of the test account is required");
  }
  const outcome = await readReconciliationOnce({
    apiKey,
    baseUrl: config.brevoTransport.baseUrl,
    fetch: globalThis.fetch,
    now: new Date(),
  });
  process.stdout.write(
    `contacts: ${outcome.contacts}, spam events: ${outcome.smtpSpamEvents}\n`,
  );
}

/** The receiver of the webhook trial; its two tokens are printed here once, and nowhere else. */
async function inbound(): Promise<void> {
  const settings = parseInboundArguments(process.argv.slice(3));
  mkdirSync(DIRECTORY, { recursive: true });
  const recorder = await startInboundRecorder({
    host: INBOUND_HOST,
    port: settings.port,
    durationMs: settings.minutes * 60_000,
    maxBodies: settings.maxBodies,
    sink: (record) => {
      appendFileSync(RAW, `${JSON.stringify(record)}\n`);
      // The operator sees that a body came, never the body.
      process.stdout.write("body recorded\n");
    },
  });
  process.stdout.write(
    [
      `listening on http://${INBOUND_HOST}:${recorder.port}, ${settings.minutes} min or ${settings.maxBodies} bodies at most (Ctrl+C stops)`,
      `  tunnel:  cloudflared tunnel --url http://${INBOUND_HOST}:${recorder.port}`,
      `  webhook: <tunnel URL>/${recorder.pathToken}`,
      `  header:  brevo-webhook-token: ${recorder.headerToken}`,
      "",
    ].join("\n"),
  );
  process.stdout.write(`stopped (${await recorder.stopped})\n`);
}

function redact(): void {
  const count = redactFile(RAW, REDACTED);
  process.stdout.write(
    [
      `${count} records redacted into ${REDACTED}`,
      `once the fixtures are written from it, delete ${RAW}`,
      "",
    ].join("\n"),
  );
}

const mode = process.argv[2];
if (mode === "redact") {
  redact();
} else if (
  mode === "worker" ||
  mode === "probes" ||
  mode === "reconciliation" ||
  mode === "inbound"
) {
  refuseOutsideTheWorkstation();
  if (mode === "inbound") {
    // Nothing is fetched: the receiver only listens.
    await inbound();
  } else {
    installRecorder();
    if (mode === "probes") {
      await probes();
    } else if (mode === "reconciliation") {
      await reconciliation();
    } else {
      // The real worker, unchanged: it runs until Ctrl+C (SIGINT ends the turn, 02 §11.2).
      await import("../src/worker.ts");
    }
  }
} else {
  process.stderr.write(
    "usage: pnpm trial:record worker | probes | reconciliation | inbound | redact\n",
  );
  process.exitCode = 1;
}
