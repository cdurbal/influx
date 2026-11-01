// The browser error collector of the CONNECTED spaces (docs/mvp/02 §20.5 and §20.10; 21 §4 J4
// point 3): uncaught errors and rejected promises, React's uncaught render errors included (they
// reach `window` through reportError), sent to POST /v1/ops/client-errors through the relay
// client. Never mounted on the landing: no collection script on the public pages (02 §20.5).
// No cookie, no storage, no retry: a report that fails is lost. A few reports per page at most.
// Lives once, in packages/web-platform (arbitration PL-07, PL-09), for both fronts.
import {
  CLIENT_ERROR_LIMITS,
  toStrictText,
  type ClientErrorReport,
} from "@influx/contracts/ops";
import { systemStatusSchema } from "@influx/contracts/system";
import { callRelay } from "../browser/relay-client";

const ROUTE = "/v1/ops/client-errors";
/** Reports per page load; the api bounds the rate again per account and per address. */
const MAX_REPORTS_PER_PAGE = 5;
const ERROR_TYPE = /^[A-Za-z][A-Za-z0-9_.:-]{0,79}$/;

function reportOf(
  kind: ClientErrorReport["kind"],
  value: unknown,
  fallback: string,
): ClientErrorReport {
  const error = value instanceof Error ? value : null;
  // Strict text (J4S-6): what the api would refuse is replaced before sending, not lost.
  const message = toStrictText(
    error?.message || fallback || "unknown error",
    CLIENT_ERROR_LIMITS.message,
  );
  const errorType = error?.name;
  return {
    kind,
    ...(errorType !== undefined && ERROR_TYPE.test(errorType)
      ? { errorType }
      : {}),
    message,
    ...(typeof error?.stack === "string"
      ? { stack: toStrictText(error.stack, CLIENT_ERROR_LIMITS.stack, true) }
      : {}),
    // The path only: never the query nor the fragment (02 §20.8).
    page: window.location.pathname.slice(0, CLIENT_ERROR_LIMITS.page),
  };
}

/** Installs the listeners; returns their removal (a React effect's clean-up). */
export function installErrorCollector(): () => void {
  let sent = 0;
  const seen = new Set<string>();
  const send = (report: ClientErrorReport) => {
    const key = `${report.kind}|${report.message}`;
    if (sent >= MAX_REPORTS_PER_PAGE || seen.has(key)) {
      return;
    }
    sent += 1;
    seen.add(key);
    void callRelay("POST", ROUTE, systemStatusSchema, report);
  };
  const onError = (event: ErrorEvent) => {
    send(reportOf("error", event.error, event.message));
  };
  const onRejection = (event: PromiseRejectionEvent) => {
    send(reportOf("unhandledrejection", event.reason, "unhandled rejection"));
  };
  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);
  return () => {
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onRejection);
  };
}
