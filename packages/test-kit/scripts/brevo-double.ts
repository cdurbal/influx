// Starts the Brevo double for local development (21 J3-C rule 10): `pnpm dev:brevo-double`.
// Loopback only. Set in apps/api/.env.local: BREVO_MODE=redirect,
// BREVO_API_BASE_URL=http://127.0.0.1:4010/v3, BREVO_API_KEY=<any local value>,
// BREVO_SENDER_TRANSACTIONAL=<a local address>, and BREVO_TEST_RECIPIENTS listing the local
// addresses that may receive a code. Then open http://127.0.0.1:4010/ to read the messages.
import { startBrevoDouble } from "../src/brevo-double.ts";

const DEFAULT_PORT = 4010;

const double = await startBrevoDouble(DEFAULT_PORT);
process.stdout.write(
  `Brevo double on ${double.baseUrl} — messages at http://127.0.0.1:${DEFAULT_PORT}/\n`,
);
