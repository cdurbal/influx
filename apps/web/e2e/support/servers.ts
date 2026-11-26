// The loopback ports of the five servers of the journeys (playwright.config.ts). Chosen away from
// those of local development (web 3000, backoffice 3001, api 3100, brevo double 4010, s3 double
// 4011), so that both can run side by side.
export const DOUBLE_PORT = 4110;
export const S3_DOUBLE_PORT = 4111;
export const API_PORT = 3110;
export const WEB_PORT = 3210;
export const BACKOFFICE_PORT = 3211;

export const DOUBLE_ORIGIN = `http://127.0.0.1:${DOUBLE_PORT}`;
export const S3_DOUBLE_ORIGIN = `http://127.0.0.1:${S3_DOUBLE_PORT}`;
export const API_ORIGIN = `http://127.0.0.1:${API_PORT}`;
export const WEB_ORIGIN = `http://127.0.0.1:${WEB_PORT}`;
export const BACKOFFICE_ORIGIN = `http://127.0.0.1:${BACKOFFICE_PORT}`;

// Synthetic loopback-only S3 SigV4 double credentials shared between s3-double and start-api.ts.
export const S3_DOUBLE_ACCESS_KEY_ID = "e2e-r2-access-key-id";
export const S3_DOUBLE_SECRET_ACCESS_KEY =
  "e2e-r2-secret-access-key-0123456789abcdef";
