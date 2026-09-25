// Server-side configuration of the relay (docs/mvp/21-plan-de-developpement.md §4, J1-F and J1-G).
// Read at each request, never when the module loads: `next build` runs without these variables.
// Imported by src/server/api-client.ts only (guard of importers, @influx/test-kit). This file is
// byte-for-byte identical in apps/web and apps/backoffice, and its SHA-256 is pinned (03 PP-12).

const MIN_SECRET_BYTES = 32;

export type ServerConfig = {
  /** Private address of apps/api: origin only, no path, no credentials (03 PP-1). */
  apiBaseUrl: URL;
  /** Value of the x-influx-internal header; one per front (03 PP-8, 21 J1-G). */
  internalSecret: string;
};

/** The relay configuration is missing or invalid. Its message names variables, never values. */
export class ServerConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ServerConfigError";
  }
}

function parseApiBaseUrl(value: string | undefined): URL {
  if (value === undefined || value === "") {
    throw new ServerConfigError("INFLUX_API_INTERNAL_URL is required");
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ServerConfigError("INFLUX_API_INTERNAL_URL must be a URL");
  }
  const isOriginOnly =
    (url.protocol === "http:" || url.protocol === "https:") &&
    url.username === "" &&
    url.password === "" &&
    url.pathname === "/" &&
    url.search === "" &&
    url.hash === "";
  if (!isOriginOnly) {
    throw new ServerConfigError(
      "INFLUX_API_INTERNAL_URL must be an http(s) origin, without path or credentials",
    );
  }
  return url;
}

function parseInternalSecret(value: string | undefined): string {
  if (value === undefined || value === "") {
    throw new ServerConfigError("INFLUX_API_INTERNAL_SECRET is required");
  }
  if (new TextEncoder().encode(value).length < MIN_SECRET_BYTES) {
    throw new ServerConfigError(
      `INFLUX_API_INTERNAL_SECRET must be at least ${MIN_SECRET_BYTES} bytes`,
    );
  }
  return value;
}

export function readServerConfig(): ServerConfig {
  return {
    apiBaseUrl: parseApiBaseUrl(process.env.INFLUX_API_INTERNAL_URL),
    internalSecret: parseInternalSecret(process.env.INFLUX_API_INTERNAL_SECRET),
  };
}
