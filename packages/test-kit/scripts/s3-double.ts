// Starts the local S3 SigV4 double for development and Playwright E2E (23 RG10–RG11):
// `pnpm dev:s3-double`. Loopback only (127.0.0.1).
// S3_DOUBLE_PORT chooses another port (4011 for local dev, 4111 in Playwright E2E).
// Optional S3_DOUBLE_ACCESS_KEY_ID / S3_DOUBLE_SECRET_ACCESS_KEY (or R2_*) override the default
// synthetic credentials when verifying SigV4 signatures.
import { startS3Double } from "../src/s3-double.ts";

const DEFAULT_PORT = 4011;

const port = Number(process.env.S3_DOUBLE_PORT ?? DEFAULT_PORT);
const accessKeyId =
  process.env.S3_DOUBLE_ACCESS_KEY_ID ?? process.env.R2_ACCESS_KEY_ID;
const secretAccessKey =
  process.env.S3_DOUBLE_SECRET_ACCESS_KEY ?? process.env.R2_SECRET_ACCESS_KEY;

const double = await startS3Double({
  port,
  ...(accessKeyId !== undefined ? { accessKeyId } : {}),
  ...(secretAccessKey !== undefined ? { secretAccessKey } : {}),
});
process.stdout.write(`S3 double on ${double.endpoint}\n`);
