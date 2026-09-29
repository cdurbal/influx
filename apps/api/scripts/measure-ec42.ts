// EC-42 measurement, local stack (21 §4, "Arbitrages de sécurité du J3", EC-42 point 1): 500
// code requests per class (address never seen, existing account), interleaved at random, the
// Brevo double without latency. For each class: duration of step 5 (GoTrue user creation) and of
// the handler without its floor (median, p99, p99.9), and the share of requests above the floor.
// Informative only (no real network): the decisive measurement is on `staging` at J4.
// Run by hand on the local stack, never in CI: `node scripts/measure-ec42.ts` from apps/api, with
// the variables of EC-51 exported. It writes accounts and GoTrue users in `example.test`: reset the
// local database afterwards (`supabase db reset`).
import { randomBytes, randomUUID } from "node:crypto";
import { startBrevoDouble } from "@influx/test-kit/brevo-double";
import {
  connectAsMigrationRole,
  localRoleUrl,
  requireLocalAuth,
  type LoginRole,
} from "@influx/test-kit/db";
import { closeDatabase, createApiDatabase } from "../src/db/index.ts";
import { createTransactionalSender } from "../src/platform/brevo-transactional.ts";
import {
  createSupabaseAuth,
  type SupabaseAuth,
} from "../src/platform/supabase.ts";
import { buildServer } from "../src/server.ts";
import { testApiConfig, WEB_SECRET } from "../tests/helpers.ts";

const PER_CLASS = 500;
const FLOOR_MS = 1_000;

type Sample = { step5: number; handler: number };
type ClassName = "unknown" | "existing";

const silent = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};
const connection = (role: LoginRole) => ({
  url: localRoleUrl(role),
  role,
  tls: false,
});

function quantile(sorted: readonly number[], q: number): number {
  const index = Math.min(sorted.length - 1, Math.ceil(q * sorted.length) - 1);
  return sorted[Math.max(0, index)] ?? Number.NaN;
}

function summary(values: readonly number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const round = (value: number) => Math.round(value * 10) / 10;
  return {
    median: round(quantile(sorted, 0.5)),
    p99: round(quantile(sorted, 0.99)),
    p999: round(quantile(sorted, 0.999)),
    max: round(sorted.at(-1) ?? Number.NaN),
  };
}

const local = await requireLocalAuth();
const gotrue = createSupabaseAuth(
  { url: local.apiUrl, secretKey: local.secretKey },
  silent,
);
const migration = connectAsMigrationRole({ max: 2 });
const database = createApiDatabase(
  { app: connection("influx_app"), auth: connection("influx_auth_login") },
  silent,
);
const double = await startBrevoDouble();

// 500 existing accounts (GoTrue user + INFLUX account), each asked once.
const existing: string[] = [];
for (let index = 0; index < PER_CLASS; index += 1) {
  const email = `ec42-existing-${randomUUID()}@example.test`;
  const created = await gotrue.createUser(email);
  if (!created.ok) {
    throw new Error("GoTrue user not created");
  }
  const accountId = randomUUID();
  await migration`
    insert into identity.accounts
      (id, auth_user_id, email, email_verified_at, country_code, preferred_language,
       display_name, is_adult_attested, adult_attested_at)
    values (${accountId}, ${created.value.userId}, ${email}, now(), 'FR', 'fr', 'EC-42',
            true, now())`;
  await migration`
    insert into identity.account_roles (account_id, role) values (${accountId}, 'creator')`;
  existing.push(email);
}

const step5 = new Map<string, number>();
const timedAuth: SupabaseAuth = {
  ...gotrue,
  async createUser(email) {
    const started = performance.now();
    const outcome = await gotrue.createUser(email);
    step5.set(email, performance.now() - started);
    return outcome;
  },
};
const server = buildServer(testApiConfig(), {
  database,
  logDestination: { write: () => undefined },
  identity: {
    supabaseAuth: timedAuth,
    sender: createTransactionalSender(
      {
        mode: "live",
        testRecipients: [],
        apiKey: "local-double-key",
        baseUrl: double.baseUrl,
        senderEmail: "no-reply@tx.influx.example",
      },
      { logger: silent },
    ),
    codeRequestFloorMs: 0,
  },
});

const plan: { email: string; kind: ClassName }[] = [
  ...existing.map((email) => ({ email, kind: "existing" as const })),
  ...Array.from({ length: PER_CLASS }, () => ({
    email: `ec42-unknown-${randomUUID()}@example.test`,
    kind: "unknown" as const,
  })),
];
// Interleaved at random (Fisher-Yates with node:crypto).
for (let index = plan.length - 1; index > 0; index -= 1) {
  const other = randomBytes(4).readUInt32BE() % (index + 1);
  const current = plan[index];
  const picked = plan[other];
  if (current !== undefined && picked !== undefined) {
    plan[index] = picked;
    plan[other] = current;
  }
}

const samples: Record<ClassName, Sample[]> = { unknown: [], existing: [] };
const outcomes = new Map<string, number>();
for (const { email, kind } of plan) {
  const started = performance.now();
  const response = await server.inject({
    method: "POST",
    url: "/v1/auth/request-code",
    headers: {
      "x-influx-internal": WEB_SECRET,
      "sec-fetch-site": "same-origin",
      "content-type": "application/json",
      "x-real-ip": `2001:db8:${randomBytes(2).toString("hex")}:${randomBytes(2).toString("hex")}::1`,
    },
    payload: JSON.stringify({ email, locale: "fr" }),
  });
  const handler = performance.now() - started;
  const outcome = response.json<{ outcome: string }>().outcome;
  outcomes.set(outcome, (outcomes.get(outcome) ?? 0) + 1);
  samples[kind].push({ step5: step5.get(email) ?? Number.NaN, handler });
}

const report = Object.fromEntries(
  (["unknown", "existing"] as const).map((kind) => {
    const handler = samples[kind].map((sample) => sample.handler);
    return [
      kind,
      {
        requests: samples[kind].length,
        step5Ms: summary(samples[kind].map((sample) => sample.step5)),
        handlerMs: summary(handler),
        aboveFloorPercent:
          Math.round(
            (handler.filter((value) => value > FLOOR_MS).length /
              handler.length) *
              10_000,
          ) / 100,
      },
    ];
  }),
);
process.stdout.write(
  `${JSON.stringify({ outcomes: Object.fromEntries(outcomes), ...report }, null, 2)}\n`,
);

await server.close();
await double.close();
await closeDatabase(database);
await migration.end({ timeout: 1 });
