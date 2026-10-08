// The loopback ports of the three servers of the journeys (playwright.config.ts). Chosen away from
// those of local development (web 3000, api 3100, double 4010), so that both can run side by side.
export const DOUBLE_PORT = 4110;
export const API_PORT = 3110;
export const WEB_PORT = 3210;

export const DOUBLE_ORIGIN = `http://127.0.0.1:${DOUBLE_PORT}`;
export const API_ORIGIN = `http://127.0.0.1:${API_PORT}`;
export const WEB_ORIGIN = `http://127.0.0.1:${WEB_PORT}`;
