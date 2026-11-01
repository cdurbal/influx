// The collection of D60 in apps/api (docs/mvp/02 §20.5; 21 §4 J4 point 3). In memory first, then
// written by a periodic flush, OUTSIDE any user transaction, on the ops pool (E-6):
// - errors: grouped by fingerprint; at most OCCURRENCES_PER_MINUTE kept per fingerprint and minute,
//   the others only counted on their group; a bounded buffer, dropped (and logged) when full;
// - requests: per (minute, method, route model), calls, 5xx, 429 and a histogram of durations in
//   the nine fixed buckets of 0016; a minute is written once it has ended;
// - process health: event loop delay (p99, max), memory and processor, once per ended minute.
// "The recording must never make the failure worse" (02 §20.5): no write is awaited by a request,
// a failed flush is logged without data and its content dropped, never retried in a loop.
import { randomUUID } from "node:crypto";
import { monitorEventLoopDelay, type IntervalHistogram } from "node:perf_hooks";
import type { ApiDatabase } from "../../db/index.ts";
import { withElevatedTransaction } from "../../db/index.ts";
import { serializeError } from "../../platform/logger.ts";
import { bucketOf, DURATION_BUCKETS_MS } from "./buckets.ts";
import {
  writeTelemetry,
  type Occurrence,
  type OpsSignal,
  type ProcessSample,
  type RequestCell,
} from "./repository.ts";
import {
  fingerprintOf,
  normalizeMessage,
  routeModelOf,
  scrubStack,
  scrubText,
} from "./scrub.ts";

/** 02 §20.5: ten occurrences kept per fingerprint and minute, the next ones only counted. */
export const OCCURRENCES_PER_MINUTE = 10;
/**
 * J4S-6: distinct browser fingerprints one account may report per hour, an upper bound of the
 * groups it may open in ops.error_groups (a fingerprint already known counts too: the recorder
 * does not read the base). Beyond, its reports of another fingerprint are dropped: a member
 * cannot fill the screen of 02 §20.5 with groups of their own making.
 */
export const BROWSER_GROUPS_PER_ACCOUNT_HOUR = 5;
/** Errors waiting for the next flush; beyond, dropped (an avalanche never saturates the base). */
export const MAX_PENDING_OCCURRENCES = 200;
const FLUSH_INTERVAL_MS = 10_000;
const MESSAGE_MAX = 500;
const STACK_MAX = 4000;
/** Engine errors whose message describes the code, not the data; any other message is withheld. */
const ENGINE_ERRORS: ReadonlySet<string> = new Set([
  "TypeError",
  "ReferenceError",
  "RangeError",
]);

export type OpsLogger = {
  warn(object: object, message: string): void;
  info(object: object, message: string): void;
};

export type ServerErrorContext = {
  route?: string | null | undefined;
  requestId?: string | null | undefined;
  accountId?: string | null | undefined;
};

export type BrowserErrorInput = {
  surface: "web" | "backoffice";
  errorType: string | undefined;
  kind: string;
  message: string;
  stack: string | undefined;
  page: string;
  accountId: string;
  userAgentSummary: string | null;
};

export type OpsRecorderSettings = {
  version: string;
  instance: string;
  now?: () => Date;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VERSION_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;

function minuteOf(date: Date): number {
  return Math.floor(date.getTime() / 60_000) * 60_000;
}

const METHODS: ReadonlySet<string> = new Set([
  "GET",
  "POST",
  "PATCH",
  "PUT",
  "DELETE",
]);

export class OpsRecorder {
  private readonly version: string;
  private readonly instance: string;
  private readonly now: () => Date;
  private pending: Occurrence[] = [];
  /** Kept occurrences per `${minute}|${fingerprint}`, for the cap of 02 §20.5. */
  private keptThisMinute = new Map<string, number>();
  /** Occurrences over the cap, per fingerprint (hex): added to the group's count at the flush. */
  private extraCounts = new Map<
    string,
    { fingerprint: Buffer; count: number }
  >();
  private droppedOccurrences = 0;
  /** J4S-6: fingerprints reported per account in the current hour (`browserHour`). */
  private browserGroups = new Map<string, Set<string>>();
  private browserHour = -1;
  private droppedBrowserGroups = 0;
  /** Request cells per minute (epoch ms), then per `${method} ${route}`. */
  private requests = new Map<number, Map<string, RequestCell>>();
  /** Signals per minute (epoch ms), for the technical alerts (15 RG165, AL61, AL62). */
  private signals = new Map<number, Map<OpsSignal, number>>();
  private loopDelay: IntervalHistogram | null = null;
  private lastCpu = process.cpuUsage();
  private lastCpuAt = Date.now();
  private processMinute: number;
  private timer: NodeJS.Timeout | null = null;
  private flushing: Promise<void> | null = null;

  constructor(settings: OpsRecorderSettings) {
    this.version = VERSION_PATTERN.test(settings.version)
      ? settings.version
      : "unknown";
    this.instance =
      scrubText(settings.instance, 64).replace(/[^A-Za-z0-9._:-]/g, "-") ||
      "api";
    this.now = settings.now ?? (() => new Date());
    this.processMinute = minuteOf(this.now());
  }

  /** A server error (5xx, uncaught): its message is kept for our own and engine errors only. */
  recordServerError(error: unknown, context: ServerErrorContext = {}): void {
    const safe = serializeError(error);
    const errorType = /^[A-Za-z][A-Za-z0-9_.:-]{0,79}$/.test(safe.type)
      ? safe.type
      : "Error";
    const raw =
      safe.message ??
      (error instanceof Error && ENGINE_ERRORS.has(errorType)
        ? error.message
        : undefined);
    const code =
      safe.errorCode === undefined ? "" : ` [${scrubText(safe.errorCode, 40)}]`;
    const message =
      raw === undefined
        ? `${errorType}${code} (message withheld)`
        : `${raw}${code}`;
    const route = routeModelOf(context.route);
    const stack = scrubStack(safe.stack, STACK_MAX);
    this.enqueue({
      source: "server",
      service: "api",
      errorType,
      rawMessage: message,
      route,
      stack,
      requestId:
        context.requestId !== null &&
        context.requestId !== undefined &&
        UUID_PATTERN.test(context.requestId)
          ? context.requestId
          : null,
      accountId:
        context.accountId !== null &&
        context.accountId !== undefined &&
        UUID_PATTERN.test(context.accountId)
          ? context.accountId
          : null,
      userAgentSummary: null,
    });
  }

  /** A browser error reported by a connected space (02 §20.5), cleaned like a server one. */
  recordBrowserError(input: BrowserErrorInput): void {
    const errorType =
      input.errorType !== undefined &&
      /^[A-Za-z][A-Za-z0-9_.:-]{0,79}$/.test(input.errorType)
        ? input.errorType
        : input.kind === "unhandledrejection"
          ? "UnhandledRejection"
          : "Error";
    const accountId = UUID_PATTERN.test(input.accountId)
      ? input.accountId
      : null;
    this.enqueue(
      {
        source: "browser",
        service: input.surface,
        errorType,
        rawMessage: input.message,
        route: routeModelOf(input.page),
        stack: scrubStack(input.stack, STACK_MAX),
        requestId: null,
        accountId,
        userAgentSummary:
          input.userAgentSummary !== null &&
          /^[\x20-\x7E]{1,120}$/.test(input.userAgentSummary)
            ? input.userAgentSummary
            : null,
      },
      (hex) => this.admitBrowserGroup(accountId ?? "unknown", hex),
    );
  }

  /** J4S-6: false once the account reported BROWSER_GROUPS_PER_ACCOUNT_HOUR other fingerprints. */
  private admitBrowserGroup(accountId: string, hex: string): boolean {
    const hour = Math.floor(this.now().getTime() / 3_600_000);
    if (hour !== this.browserHour) {
      this.browserHour = hour;
      this.browserGroups.clear();
    }
    let fingerprints = this.browserGroups.get(accountId);
    if (fingerprints === undefined) {
      fingerprints = new Set();
      this.browserGroups.set(accountId, fingerprints);
    }
    if (fingerprints.has(hex)) {
      return true;
    }
    if (fingerprints.size >= BROWSER_GROUPS_PER_ACCOUNT_HOUR) {
      this.droppedBrowserGroups += 1;
      return false;
    }
    fingerprints.add(hex);
    return true;
  }

  /** One completed request (onResponse): method, route model, status and duration. */
  recordRequest(
    method: string,
    route: string | undefined,
    status: number,
    durationMs: number,
  ): void {
    if (!METHODS.has(method)) {
      return;
    }
    const minute = minuteOf(this.now());
    const model =
      route === undefined ? "unmatched" : (routeModelOf(route) ?? "unmatched");
    let cells = this.requests.get(minute);
    if (cells === undefined) {
      cells = new Map();
      this.requests.set(minute, cells);
    }
    const key = `${method} ${model}`;
    let cell = cells.get(key);
    if (cell === undefined) {
      cell = {
        method,
        route: model,
        count: 0,
        serverErrors: 0,
        throttled: 0,
        buckets: new Array<number>(DURATION_BUCKETS_MS.length + 1).fill(0),
      };
      cells.set(key, cell);
    }
    cell.count += 1;
    if (status >= 500) {
      cell.serverErrors += 1;
    }
    if (status === 429) {
      cell.throttled += 1;
    }
    const bucket = bucketOf(Math.max(0, durationMs));
    cell.buckets[bucket] = (cell.buckets[bucket] ?? 0) + 1;
  }

  /** Counts a signal in the current minute (ops.signal_counts, written once the minute ends). */
  recordSignal(signal: OpsSignal): void {
    const minute = minuteOf(this.now());
    let counts = this.signals.get(minute);
    if (counts === undefined) {
      counts = new Map();
      this.signals.set(minute, counts);
    }
    counts.set(signal, (counts.get(signal) ?? 0) + 1);
  }

  /** Starts the periodic flush and the event loop measurement (main.ts only). */
  start(database: ApiDatabase, logger: OpsLogger): void {
    if (this.timer !== null) {
      return;
    }
    this.loopDelay = monitorEventLoopDelay({ resolution: 20 });
    this.loopDelay.enable();
    this.timer = setInterval(() => {
      void this.flush(database, logger);
    }, FLUSH_INTERVAL_MS);
    this.timer.unref();
  }

  /** Stops the timer and writes what is pending, ended minutes only (graceful shutdown). */
  async stop(database: ApiDatabase, logger: OpsLogger): Promise<void> {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    await this.flush(database, logger);
    this.loopDelay?.disable();
  }

  /** One flush: never two at once, never thrown, never retried. */
  flush(database: ApiDatabase, logger: OpsLogger): Promise<void> {
    this.flushing ??= this.write(database, logger).finally(() => {
      this.flushing = null;
    });
    return this.flushing;
  }

  /** `admit`: a last say on the fingerprint (J4S-6), before anything is kept or counted. */
  private enqueue(
    entry: {
      source: Occurrence["source"];
      service: Occurrence["service"];
      errorType: string;
      rawMessage: string;
      route: string | null;
      stack: string | null;
      requestId: string | null;
      accountId: string | null;
      userAgentSummary: string | null;
    },
    admit?: (hex: string) => boolean,
  ): void {
    const message = scrubText(entry.rawMessage, MESSAGE_MAX) || entry.errorType;
    const groupMessage =
      normalizeMessage(entry.rawMessage, MESSAGE_MAX) || entry.errorType;
    const fingerprint = fingerprintOf({
      errorType: entry.errorType,
      message: groupMessage,
      route: entry.route,
      stack: entry.stack,
    });
    const hex = fingerprint.toString("hex");
    if (admit !== undefined && !admit(hex)) {
      return;
    }
    const capKey = `${minuteOf(this.now())}|${hex}`;
    const kept = this.keptThisMinute.get(capKey) ?? 0;
    if (
      kept >= OCCURRENCES_PER_MINUTE ||
      this.pending.length >= MAX_PENDING_OCCURRENCES
    ) {
      if (kept < OCCURRENCES_PER_MINUTE) {
        this.droppedOccurrences += 1;
      }
      const extra = this.extraCounts.get(hex);
      this.extraCounts.set(hex, {
        fingerprint,
        count: (extra?.count ?? 0) + 1,
      });
      return;
    }
    this.keptThisMinute.set(capKey, kept + 1);
    this.pending.push({
      fingerprint,
      source: entry.source,
      service: entry.service,
      errorType: entry.errorType,
      groupMessage,
      message,
      route: entry.route,
      stack: entry.stack,
      requestId: entry.requestId,
      accountId: entry.accountId,
      userAgentSummary: entry.userAgentSummary,
    });
  }

  private takeEndedMinutes(): { minute: number; cells: RequestCell[] }[] {
    const current = minuteOf(this.now());
    const ended: { minute: number; cells: RequestCell[] }[] = [];
    for (const [minute, cells] of this.requests) {
      if (minute < current) {
        ended.push({ minute, cells: [...cells.values()] });
        this.requests.delete(minute);
      }
    }
    for (const key of this.keptThisMinute.keys()) {
      if (Number(key.slice(0, key.indexOf("|"))) < current) {
        this.keptThisMinute.delete(key);
      }
    }
    return ended;
  }

  private takeEndedSignals(): {
    minute: number;
    counts: { signal: OpsSignal; count: number }[];
  }[] {
    const current = minuteOf(this.now());
    const ended: {
      minute: number;
      counts: { signal: OpsSignal; count: number }[];
    }[] = [];
    for (const [minute, counts] of this.signals) {
      if (minute < current) {
        ended.push({
          minute,
          counts: [...counts].map(([signal, count]) => ({ signal, count })),
        });
        this.signals.delete(minute);
      }
    }
    return ended;
  }

  private takeProcessSample(): ProcessSample | null {
    const current = minuteOf(this.now());
    if (current <= this.processMinute || this.loopDelay === null) {
      return null;
    }
    const minute = current - 60_000;
    this.processMinute = current;
    const toMs = (nanoseconds: number) =>
      Number.isFinite(nanoseconds) ? Math.round(nanoseconds / 10_000) / 100 : 0;
    const p99 = toMs(this.loopDelay.percentile(99));
    const max = Math.max(p99, toMs(this.loopDelay.max));
    this.loopDelay.reset();
    const memory = process.memoryUsage();
    const cpu = process.cpuUsage(this.lastCpu);
    const elapsedMs = Math.max(1, Date.now() - this.lastCpuAt);
    this.lastCpu = process.cpuUsage();
    this.lastCpuAt = Date.now();
    // Microseconds of processor over milliseconds elapsed, divided by 10: a percentage.
    const cpuLoad = Math.min(6400, (cpu.user + cpu.system) / (10 * elapsedMs));
    return {
      minute,
      p99,
      max,
      rss: memory.rss,
      heap: memory.heapUsed,
      cpu: Number(cpuLoad.toFixed(2)),
    };
  }

  private async write(database: ApiDatabase, logger: OpsLogger): Promise<void> {
    const occurrences = this.pending;
    this.pending = [];
    const extras = [...this.extraCounts.values()];
    this.extraCounts.clear();
    const dropped = this.droppedOccurrences;
    this.droppedOccurrences = 0;
    const droppedBrowserGroups = this.droppedBrowserGroups;
    this.droppedBrowserGroups = 0;
    const minutes = this.takeEndedMinutes();
    const signals = this.takeEndedSignals();
    const processSample = this.takeProcessSample();
    if (dropped > 0) {
      logger.warn({ dropped }, "ops occurrences dropped, buffer full");
    }
    if (droppedBrowserGroups > 0) {
      logger.info(
        { dropped: droppedBrowserGroups },
        "browser reports dropped, account over its new groups per hour",
      );
    }
    if (
      occurrences.length === 0 &&
      extras.length === 0 &&
      minutes.length === 0 &&
      signals.length === 0 &&
      processSample === null
    ) {
      return;
    }
    try {
      await withElevatedTransaction(
        database,
        "ops.record_telemetry",
        randomUUID(),
        async (tx) => {
          await writeTelemetry(tx, {
            version: this.version,
            instance: this.instance,
            occurrences,
            extras,
            minutes,
            processSample,
            signals,
          });
          return { value: undefined, auditSubject: null };
        },
      );
    } catch (error) {
      // Never retried: the content is dropped, the cause logged without data (02 §20.5).
      logger.warn(
        {
          err: error,
          occurrences: occurrences.length,
          minutes: minutes.length,
        },
        "ops flush failed, content dropped",
      );
    }
  }
}
