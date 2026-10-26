// The internal probe of D60 (02 §20.5, "Sonde interne"; 15 RG165, AL49 and AL54): every minute, the
// worker loads the home pages FR and EN BY THEIR PUBLIC ORIGIN (the way goes through the internet,
// the DNS, the certificate and Railway's edge), the sign-in page of the backoffice, and the /health
// of the api on the private network (which checks the base). Each answer is judged and timed: up is
// a 200 alone (a redirect is a failure: the page a visitor gets is elsewhere), the body read to its
// end. Nothing of the answer is kept but its status, its duration and a closed failure code; the
// URL is never written anywhere (02 §20.8: the target is a name).
import type {
  ProbeFailure,
  ProbeResult,
  ProbeTarget,
} from "./technical-alerts.ts";
import type { ProbeOrigins } from "../../config/schema.ts";

/** The bound of one check, body included. */
export const PROBE_TIMEOUT_MS = 10_000;

/** What the probe calls itself in the logs of the targets. */
export const PROBE_USER_AGENT = "INFLUX-probe/1";

/** The path of each target on its origin (01 §2: /fr and /en; 17b §3.14.a: / of the backoffice). */
export function probeUrlsOf(
  origins: ProbeOrigins,
): Record<ProbeTarget, string> {
  return {
    web_home_fr: new URL("/fr", origins.web).href,
    web_home_en: new URL("/en", origins.web).href,
    backoffice_sign_in: new URL("/", origins.backoffice).href,
    api_health: new URL("/health", origins.api).href,
  };
}

function failureOf(error: unknown): ProbeFailure {
  return error instanceof Error &&
    (error.name === "TimeoutError" || error.name === "AbortError")
    ? "timeout"
    : "connection";
}

/** One check; never throws. `elapsed` gives milliseconds since an arbitrary origin. */
export async function probeTarget(
  target: ProbeTarget,
  url: string,
  dependencies: {
    fetch: typeof fetch;
    now: () => Date;
    elapsed: () => number;
    timeoutMs?: number;
  },
): Promise<ProbeResult> {
  const checkedAt = dependencies.now().toISOString();
  const started = dependencies.elapsed();
  const signal = AbortSignal.timeout(
    dependencies.timeoutMs ?? PROBE_TIMEOUT_MS,
  );
  const done = (
    outcome: "up" | "down",
    statusCode: number | null,
    failureCode: ProbeFailure | null,
  ): ProbeResult => ({
    target,
    checkedAt,
    outcome,
    statusCode,
    failureCode,
    durationMs: Math.max(0, Math.round(dependencies.elapsed() - started)),
  });
  let response: Response;
  try {
    response = await dependencies.fetch(url, {
      method: "GET",
      redirect: "manual",
      headers: {
        "user-agent": PROBE_USER_AGENT,
        accept: "text/html,application/json",
      },
      signal,
    });
  } catch (error) {
    return done("down", null, failureOf(error));
  }
  if (response.status >= 300 && response.status < 400) {
    await response.body?.cancel().catch(() => undefined);
    return done("down", response.status, "redirect");
  }
  try {
    await response.arrayBuffer();
  } catch (error) {
    return done(
      "down",
      response.status,
      failureOf(error) === "timeout" ? "timeout" : "body",
    );
  }
  return response.status === 200
    ? done("up", 200, null)
    : done("down", response.status, "status");
}

/** The four checks of a round, side by side. */
export async function probeAll(
  origins: ProbeOrigins,
  dependencies: Parameters<typeof probeTarget>[2],
): Promise<ProbeResult[]> {
  const urls = probeUrlsOf(origins);
  return Promise.all(
    (Object.keys(urls) as ProbeTarget[]).map((target) =>
      probeTarget(target, urls[target], dependencies),
    ),
  );
}
