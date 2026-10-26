// What the "Santé technique" screen shows, computed from the answers of apps/api (docs/mvp/02
// §20.5; 15 RG165; 21 §J9 commit 9). Pure functions, outside the components: durations, ages,
// shares and sizes in French (D36 open), the sorts of the table of routes and the curves. No rule is
// decided here — apps/api and the database decide (the p95, the state of the worker, the
// regression); this module only words, sorts and draws.
import type {
  OpsProbe,
  OpsProbeWindow,
  OpsTrafficPoint,
  OpsTrafficRoute,
  OpsTrafficSummary,
} from "@influx/contracts/backoffice-ops";
import { messages } from "@/messages/fr";

const LOCALE = "fr-FR";

const oneDecimal = new Intl.NumberFormat(LOCALE, {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});
const twoDecimals = new Intl.NumberFormat(LOCALE, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const integer = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 });

export function formatCount(value: number): string {
  return integer.format(value);
}

/** "25 ms", "1,5 s": the very bounds of the histogram read well. */
export function formatMs(ms: number): string {
  return ms >= 1000
    ? `${oneDecimal.format(ms / 1000)} s`
    : `${integer.format(ms)} ms`;
}

/** The p95 is the upper bound of a bucket of the histogram: "≤ 500 ms", "> 5 s", or a dash. */
export function formatP95(summary: {
  p95Ms: number | null;
  p95Beyond: boolean;
}): string {
  if (summary.p95Ms === null) {
    return messages.common.none;
  }
  return summary.p95Beyond
    ? `> ${formatMs(summary.p95Ms)}`
    : `≤ ${formatMs(summary.p95Ms)}`;
}

/** Calls per minute: "0,4", "12", "1 240". */
export function formatRate(callsPerMinute: number): string {
  return callsPerMinute >= 10
    ? integer.format(callsPerMinute)
    : oneDecimal.format(callsPerMinute);
}

/** The 5xx over the calls, "0,35 %"; a dash when nothing was called. */
export function formatErrorRate(serverErrors: number, calls: number): string {
  return calls === 0
    ? messages.common.none
    : `${twoDecimals.format((serverErrors * 100) / calls)} %`;
}

/** The share of failed checks, as an availability: "99,93 %"; a dash before any check. */
export function formatAvailability(window: OpsProbeWindow): string {
  return window.checks === 0
    ? messages.common.none
    : `${twoDecimals.format(((window.checks - window.failures) * 100) / window.checks)} %`;
}

/** A reading older than this (the probe and the samples are written every minute) is called old. */
export const STALE_AFTER_SECONDS = 180;

/** Whole seconds from an instant to the `now` of the same answer (never negative). */
export function secondsSince(now: string, instant: string): number {
  return Math.max(
    0,
    Math.floor((Date.parse(now) - Date.parse(instant)) / 1000),
  );
}

/** "12 s", "3 min", "2 h 10 min", "4 j": how old a reading is. */
export function formatAge(seconds: number): string {
  if (seconds < 60) {
    return `${seconds} s`;
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    const rest = minutes % 60;
    return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
  }
  return `${Math.floor(hours / 24)} j`;
}

/** "190 Mo": memory in mebibytes, as the hosting shows it. */
export function formatBytes(bytes: number): string {
  return `${integer.format(bytes / 1_048_576)} Mo`;
}

export function formatPercent(value: number): string {
  return `${oneDecimal.format(value)} %`;
}

/** How full the base is: "23 %". */
export function connectionShare(connections: number, max: number): number {
  return Math.round((connections * 100) / Math.max(1, max));
}

/** A value of an alert: a number as is, an instant in French, a text as is, a dash for null. */
export function formatAlertValue(value: string | number | null): string {
  if (value === null) {
    return messages.common.none;
  }
  if (typeof value === "number") {
    return integer.format(value);
  }
  return value;
}

/** The state of a target, from its latest check; unknown before the first one. */
export function probeState(probe: OpsProbe): "up" | "down" | "unknown" {
  return probe.last === null ? "unknown" : probe.last.outcome;
}

export type RouteSort = "calls" | "p95" | "errors";

/** The p95 as a number to sort on: nothing measured last, "beyond" above every bound. */
function p95Key(summary: OpsTrafficSummary): number {
  if (summary.p95Ms === null) {
    return -1;
  }
  return summary.p95Beyond ? summary.p95Ms + 1 : summary.p95Ms;
}

/** The routes sorted by calls, by p95 or by the share of 5xx (highest first, then by name). */
export function sortRoutes(
  routes: readonly OpsTrafficRoute[],
  by: RouteSort,
): OpsTrafficRoute[] {
  const key = (route: OpsTrafficRoute): number => {
    switch (by) {
      case "p95":
        return p95Key(route.summary);
      case "errors":
        return route.summary.calls === 0
          ? 0
          : route.summary.serverErrors / route.summary.calls;
      default:
        return route.summary.calls;
    }
  };
  return [...routes].sort(
    (left, right) =>
      key(right) - key(left) ||
      left.route.localeCompare(right.route, LOCALE) ||
      left.method.localeCompare(right.method, LOCALE),
  );
}

/** What a curve is drawn from, one value per bucket of time; null where nothing was measured. */
export type CurveKind = "calls" | "p95" | "errors";

export function curveValues(
  points: readonly OpsTrafficPoint[],
  kind: CurveKind,
): (number | null)[] {
  return points.map((point) => {
    switch (kind) {
      case "calls":
        return point.callsPerMinute;
      case "p95":
        return point.p95Ms === null
          ? null
          : point.p95Ms + (point.p95Beyond ? 1 : 0);
      default:
        return point.calls === 0
          ? null
          : (point.serverErrors * 100) / point.calls;
    }
  });
}

/**
 * The segments of a curve in a box of `width` x `height`: one polyline per run of measured
 * values, so that a bucket with nothing measured leaves a gap rather than a false zero. The scale
 * starts at 0 and ends at the largest value (or `ceiling` when given, so that two curves compare).
 */
export function curveSegments(
  values: readonly (number | null)[],
  width: number,
  height: number,
  ceiling?: number,
): string[] {
  const max = Math.max(
    ceiling ?? 0,
    ...values.map((value) => (value === null ? 0 : value)),
  );
  const scale = max === 0 ? 0 : (height - 2) / max;
  const step = values.length <= 1 ? 0 : width / (values.length - 1);
  const segments: string[] = [];
  let run: string[] = [];
  const flush = () => {
    if (run.length > 0) {
      // a lone point is drawn as a very short segment, otherwise it would not show
      segments.push(run.length === 1 ? `${run[0]} ${run[0]}` : run.join(" "));
      run = [];
    }
  };
  for (const [index, value] of values.entries()) {
    if (value === null) {
      flush();
      continue;
    }
    const x = Math.round(index * step * 10) / 10;
    const y = Math.round((height - 1 - value * scale) * 10) / 10;
    run.push(`${x},${y}`);
  }
  flush();
  return segments;
}
