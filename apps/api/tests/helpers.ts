// Shared fixtures of the apps/api tests. Fake values only.
import type { DestinationStream } from "pino";
import { parseApiEnvironment, type ApiConfig } from "../src/config/schema.ts";

export const WEB_SECRET = "web-internal-secret-for-tests-0123456789";
export const BACKOFFICE_SECRET = "backoffice-internal-secret-for-tests-01234";

export function testApiConfig(): ApiConfig {
  return parseApiEnvironment({
    INFLUX_ENV: "staging",
    INFLUX_API_INTERNAL_SECRET_WEB: WEB_SECRET,
    INFLUX_API_INTERNAL_SECRET_BACKOFFICE: BACKOFFICE_SECRET,
  });
}

/** A log destination that keeps every line in memory. */
export function captureLogs(): {
  destination: DestinationStream;
  text: () => string;
} {
  const lines: string[] = [];
  return {
    destination: {
      write(line: string) {
        lines.push(line);
      },
    },
    text: () => lines.join(""),
  };
}
