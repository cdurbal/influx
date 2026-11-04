// The browser journeys of the J5 (docs/mvp/21 §J5 "Tests"; archives/jalons/j5-fiche.md, commit 6): the two
// nominal sign-ups, one per door, and the D66 rules that only a real browser shows (reload, change
// of language, the resume that gives up); since J7 "mon compte", since J8 the backoffice v0
// (e2e/backoffice.spec.ts). Everything runs on the loopback, against the local Supabase stack: the
// Brevo double receives the codes (16 RG148), no worker runs (the queue stays as the journeys
// leave it), no external service is ever called.
// Four servers, started here and stopped at the end, never reused: a server already on one of
// these ports is an error, not a shortcut (its configuration would not be this one).
// - The Brevo double, whose `GET /messages` is the members' inbox.
// - apps/api, from its sources, as `development` (02 §12.4, D70) in `redirect` mode towards the
//   double: only the addresses of e2e/support/mailboxes.ts receive a code (verrou 3). No env file
//   is ever loaded (16 RG148). The local stack's secret key is
//   read by e2e/start-api.ts from the Supabase CLI, never from a file.
// - apps/web and apps/backoffice, built then started (CI: started only, the `e2e` job of ci.yml
//   has just built them).
// The secrets below are fake values for this run only, like those of apps/api/tests/helpers.ts.
import { defineConfig, devices } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { E2E_RUN_VARIABLE, mailboxAddresses } from "./e2e/support/mailboxes";
import {
  API_ORIGIN,
  API_PORT,
  BACKOFFICE_ORIGIN,
  BACKOFFICE_PORT,
  DOUBLE_ORIGIN,
  DOUBLE_PORT,
  WEB_ORIGIN,
  WEB_PORT,
} from "./e2e/support/servers";

const WEB_SECRET = "e2e-web-internal-secret-0123456789abcdef";
const BACKOFFICE_SECRET = "e2e-backoffice-internal-secret-0123456789";

// One identifier per run, read again by the workers (they inherit this environment): the
// addresses of a run are new, whatever the runs before it left in the local stack.
process.env[E2E_RUN_VARIABLE] ??= randomUUID().slice(0, 8);

const SERVER_TIMEOUT_MS = 240_000;

// L2C-14a: the merge job of ci.yml runs TK3.1 alone (`--project=charter-headings --no-deps`) on the
// surveys of both shards, which it names here: no stack and no server then, and the surveys are put
// back by e2e/restore-headings.ts. Unset everywhere else, locally and in the shards.
const HEADINGS_FROM = process.env.E2E_HEADINGS_FROM;

export default defineConfig({
  testDir: "e2e",
  globalSetup:
    HEADINGS_FROM === undefined
      ? "./e2e/global-setup.ts"
      : "./e2e/restore-headings.ts",
  // A journey waits for real servers (the code floor of 1 s, GoTrue, a 10 s countdown).
  timeout: 60_000,
  expect: { timeout: 10_000 },
  // Never retried: a retry would hide a flaky journey, and its address is already signed up.
  retries: 0,
  // J8T-8: two workers, but e2e/backoffice.spec.ts is serial and the only file that seeds an admin
  // (its degraded dual control deactivates every other admin for a while). A new file that needs
  // an admin joins it, never a file of its own; and no other job ever shares this local stack
  // while the journeys run (ci.yml: the `e2e` job starts a stack of its own).
  workers: 2,
  forbidOnly: process.env.CI !== undefined,
  // J8T-6: the JSON report is read after the run by the floor of executed tests (e2e/case-floors.ts,
  // `pnpm test:e2e`). Written at the end of the run, after Playwright emptied test-results/.
  reporter: [
    [process.env.CI !== undefined ? "list" : "dot"],
    ["json", { outputFile: "test-results/e2e-report.json" }],
  ],
  use: {
    baseURL: WEB_ORIGIN,
    trace: "retain-on-failure",
  },
  // TK3.1 (D75; 18 §12.6) reads what the axe passes of "chromium" recorded: a project of its own,
  // run once they all passed. Its spec navigates nowhere.
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: /charter-headings\.spec\.ts$/,
    },
    {
      name: "charter-headings",
      testMatch: /charter-headings\.spec\.ts$/,
      dependencies: ["chromium"],
    },
  ],
  webServer:
    HEADINGS_FROM !== undefined
      ? []
      : [
          {
            command: "node ../../packages/test-kit/scripts/brevo-double.ts",
            url: `${DOUBLE_ORIGIN}/messages`,
            env: { BREVO_DOUBLE_PORT: String(DOUBLE_PORT) },
            reuseExistingServer: false,
            timeout: SERVER_TIMEOUT_MS,
          },
          {
            command: "node e2e/start-api.ts",
            url: `${API_ORIGIN}/health`,
            env: {
              INFLUX_ENV: "development",
              PORT: String(API_PORT),
              INFLUX_API_INTERNAL_SECRET_WEB: WEB_SECRET,
              INFLUX_API_INTERNAL_SECRET_BACKOFFICE: BACKOFFICE_SECRET,
              INFLUX_PUBLIC_SITE_URL: WEB_ORIGIN,
              INFLUX_PUBLIC_BACKOFFICE_URL: BACKOFFICE_ORIGIN,
              AUTH_THROTTLE_PEPPER: "e2e-throttle-pepper-0123456789abcdef0123",
              AUTH_TOKEN_SIGNING_SECRET:
                "e2e-token-signing-secret-0123456789abcd",
              BREVO_MODE: "redirect",
              BREVO_API_BASE_URL: `${DOUBLE_ORIGIN}/v3`,
              BREVO_API_KEY: "e2e-brevo-double-key",
              BREVO_SENDER_TRANSACTIONAL: "codes@e2e.example.test",
              BREVO_TEST_RECIPIENTS: mailboxAddresses().join(","),
            },
            reuseExistingServer: false,
            timeout: SERVER_TIMEOUT_MS,
          },
          {
            command:
              process.env.CI !== undefined
                ? `pnpm exec next start -H 127.0.0.1 -p ${WEB_PORT}`
                : `pnpm exec next build && pnpm exec next start -H 127.0.0.1 -p ${WEB_PORT}`,
            url: `${WEB_ORIGIN}/fr/connexion`,
            env: {
              INFLUX_ENV: "development",
              INFLUX_API_INTERNAL_URL: API_ORIGIN,
              INFLUX_API_INTERNAL_SECRET: WEB_SECRET,
            },
            reuseExistingServer: false,
            timeout: SERVER_TIMEOUT_MS,
          },
          {
            command:
              process.env.CI !== undefined
                ? `pnpm exec next start -H 127.0.0.1 -p ${BACKOFFICE_PORT}`
                : `pnpm exec next build && pnpm exec next start -H 127.0.0.1 -p ${BACKOFFICE_PORT}`,
            cwd: "../backoffice",
            url: `${BACKOFFICE_ORIGIN}/`,
            env: {
              INFLUX_API_INTERNAL_URL: API_ORIGIN,
              INFLUX_API_INTERNAL_SECRET: BACKOFFICE_SECRET,
            },
            reuseExistingServer: false,
            timeout: SERVER_TIMEOUT_MS,
          },
        ],
});
