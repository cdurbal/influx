// Shared fixtures of the apps/api tests. Fake values only.
import { captureLogStream, type LogCapture } from "@influx/test-kit/logs";
import type { DestinationStream } from "pino";
import { parseApiEnvironment, type ApiConfig } from "../src/config/schema.ts";

export const WEB_SECRET = "web-internal-secret-for-tests-0123456789";
export const BACKOFFICE_SECRET = "backoffice-internal-secret-for-tests-01234";
export const THROTTLE_PEPPER = "throttle-pepper-for-tests-0123456789abcdef";
/** Public origins of the two surfaces (03 §6.4 A4). */
export const WEB_ORIGIN = "https://influx.example";
export const BACKOFFICE_ORIGIN = "https://bo.influx.example";

/** Local-stack shaped database URLs (fake passwords, never reached by these tests). */
export const TEST_DATABASE_URLS = {
  DATABASE_URL: "postgresql://influx_app:app-pass@127.0.0.1:54322/postgres",
  AUTH_DATABASE_URL:
    "postgresql://influx_auth_login:auth-pass@127.0.0.1:54322/postgres",
  WORKER_DATABASE_URL:
    "postgresql://influx_worker_login:worker-pass@127.0.0.1:54322/postgres",
} as const;

export function testApiConfig(): ApiConfig {
  return parseApiEnvironment({
    INFLUX_ENV: "staging",
    INFLUX_API_INTERNAL_SECRET_WEB: WEB_SECRET,
    INFLUX_API_INTERNAL_SECRET_BACKOFFICE: BACKOFFICE_SECRET,
    INFLUX_PUBLIC_SITE_URL: WEB_ORIGIN,
    INFLUX_PUBLIC_BACKOFFICE_URL: BACKOFFICE_ORIGIN,
    AUTH_THROTTLE_PEPPER: THROTTLE_PEPPER,
    DATABASE_URL: TEST_DATABASE_URLS.DATABASE_URL,
    AUTH_DATABASE_URL: TEST_DATABASE_URLS.AUTH_DATABASE_URL,
  });
}

/**
 * Keys that appear twice in the same object of a JSON text, found on the RAW text: `JSON.parse`
 * silently keeps the last value (18 T13.7). Each entry is the dotted path of the repeated key; an
 * empty list means no duplicate. The text must be valid JSON (parse it first).
 */
export function duplicateJsonKeys(text: string): string[] {
  const duplicates: string[] = [];
  let index = 0;

  const skipWhitespace = () => {
    while (/\s/.test(text.charAt(index))) {
      index += 1;
    }
  };

  // Returns the decoded string whose opening quote is at `index`.
  const readString = (): string => {
    const start = index;
    index += 1;
    while (text.charAt(index) !== '"') {
      index += text.charAt(index) === "\\" ? 2 : 1;
    }
    index += 1;
    return JSON.parse(text.slice(start, index)) as string;
  };

  const readValue = (path: string): void => {
    skipWhitespace();
    const char = text.charAt(index);
    if (char === "{") {
      readObject(path);
    } else if (char === "[") {
      readArray(path);
    } else if (char === '"') {
      readString();
    } else {
      // Number, true, false or null.
      while (index < text.length && !/[\s,\]}]/.test(text.charAt(index))) {
        index += 1;
      }
    }
  };

  const readArray = (path: string): void => {
    index += 1;
    skipWhitespace();
    if (text.charAt(index) === "]") {
      index += 1;
      return;
    }
    for (;;) {
      readValue(`${path}[]`);
      skipWhitespace();
      const separator = text.charAt(index);
      index += 1;
      if (separator === "]") {
        return;
      }
    }
  };

  const readObject = (path: string): void => {
    index += 1;
    const seen = new Set<string>();
    skipWhitespace();
    if (text.charAt(index) === "}") {
      index += 1;
      return;
    }
    for (;;) {
      skipWhitespace();
      const key = readString();
      const keyPath = path === "" ? key : `${path}.${key}`;
      if (seen.has(key)) {
        duplicates.push(keyPath);
      }
      seen.add(key);
      skipWhitespace();
      index += 1; // The colon.
      readValue(keyPath);
      skipWhitespace();
      const separator = text.charAt(index);
      index += 1;
      if (separator === "}") {
        return;
      }
    }
  };

  readValue("");
  return duplicates;
}

/**
 * A log destination that keeps every line in memory: the capture of C-1 (21 J1-J), whose
 * `valuesFoundIn` searches the text by value (@influx/test-kit/logs).
 */
export function captureLogs(): LogCapture & { destination: DestinationStream } {
  return captureLogStream();
}
