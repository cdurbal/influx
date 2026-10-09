// The manual trial of J6 commit 7 (docs/mvp/16 RG115, RG148; D62), run by the founder on the
// workstation only, with the TEST accounts of Brevo and Apollo. Never in CI, never on Railway.
//
//   pnpm trial:record worker   the real worker drains the local queue; its exchanges are recorded
//   pnpm trial:record probes   the answers the worker alone does not meet (update, 404, 400, 401)
//   pnpm trial:record redact   the raw recordings, redacted, for the fixtures of packages/test-kit
//
// The raw recordings (addresses and ids of the test accounts) stay in .provider-recordings/,
// ignored by Git; only redacted.json is read to write the fixtures.
import { randomUUID } from "node:crypto";
import {
  appendFileSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { loadWorkerConfig } from "../src/config/index.ts";
import { createApolloClient } from "../src/domains/leads/connectors/apollo/client.ts";
import { createBrevoClient } from "../src/domains/leads/connectors/brevo/client.ts";
import {
  recordingFetch,
  redactRecords,
  type ProviderRecord,
} from "./provider-recording.ts";
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

function redact(): void {
  const records = readFileSync(RAW, "utf8")
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as ProviderRecord);
  writeFileSync(
    REDACTED,
    `${JSON.stringify(redactRecords(records), null, 2)}\n`,
  );
  process.stdout.write(
    `${records.length} exchanges redacted into ${REDACTED}\n`,
  );
}

const mode = process.argv[2];
if (mode === "redact") {
  redact();
} else if (mode === "worker" || mode === "probes") {
  refuseOutsideTheWorkstation();
  installRecorder();
  if (mode === "probes") {
    await probes();
  } else {
    // The real worker, unchanged: it runs until Ctrl+C (SIGINT ends the turn, 02 §11.2).
    await import("../src/worker.ts");
  }
} else {
  process.stderr.write("usage: pnpm trial:record worker | probes | redact\n");
  process.exitCode = 1;
}
