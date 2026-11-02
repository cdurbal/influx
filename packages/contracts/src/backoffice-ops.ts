// Contract of the "Santé technique" screen of the backoffice, read-only and reserved to the
// administrators (docs/mvp/02 §20.5, "Écran « Santé technique »"; 15 RG165; 21 §J9 point 9; EC-J9-5;
// migration 0148). Shared by apps/api and apps/backoffice. Five reads, no write:
//   GET /v1/bo/ops/status      the probe, the worker, the periodic tasks, the open technical alerts;
//   GET /v1/bo/ops/errors      the error groups of one state;
//   GET /v1/bo/ops/errors/:id  one group and its kept occurrences;
//   GET /v1/bo/ops/traffic     calls, p95 and error rate per route over a window;
//   GET /v1/bo/ops/processes   the processes and the connections of the base.
// Nothing of 02 §20.8 can be here: a route is a MODEL, a message is the normalised or cleaned one,
// an instance is a replica identifier, an account is a uuid. The p95 is computed by apps/api from
// the histograms added up over every instance (02 §20.5): it is the upper bound of a bucket, never
// a measured value, and `null` when nothing was measured; `p95Beyond` says "more than 5 s".
import { z } from "./zod.ts";

/** The targets of the probe (ops.probe_target, 0147). */
export const OPS_PROBE_TARGETS = [
  "web_home_fr",
  "web_home_en",
  "backoffice_sign_in",
  "api_health",
] as const;
export type OpsProbeTarget = (typeof OPS_PROBE_TARGETS)[number];

export const OPS_PROBE_FAILURES = [
  "timeout",
  "connection",
  "status",
  "redirect",
  "body",
] as const;

/** The states of an error group (ops.error_status, 0016). */
export const OPS_ERROR_STATUSES = [
  "new",
  "acknowledged",
  "fixed",
  "ignored",
] as const;
export type OpsErrorStatus = (typeof OPS_ERROR_STATUSES)[number];

/** The lists of the screen: `open` is new + acknowledged; `regression` is a reopened group still open. */
export const OPS_ERROR_FILTERS = [
  "open",
  "regression",
  "new",
  "acknowledged",
  "fixed",
  "ignored",
  "all",
] as const;
export type OpsErrorFilter = (typeof OPS_ERROR_FILTERS)[number];

export const OPS_ERROR_SOURCES = ["server", "browser"] as const;
export const OPS_SERVICES = ["api", "worker", "web", "backoffice"] as const;

/** The E-4 periodic tasks (ops.periodic_task, 0117, 0136, 0147, 0205). */
export const OPS_PERIODIC_TASKS = [
  "brevo_reconciliation",
  "auth_orphan_purge",
  "brevo_inbound_purge",
  "data_export_purge",
  "ops_retention",
  "storage_purge",
] as const;
export type OpsPeriodicTask = (typeof OPS_PERIODIC_TASKS)[number];

export const OPS_TRAFFIC_WINDOWS = ["hour", "day", "week"] as const;
export type OpsTrafficWindow = (typeof OPS_TRAFFIC_WINDOWS)[number];

/** Error groups a list returns, at most. */
export const OPS_ERROR_LIST_CAP = 100;
/** Occurrences of a group the screen shows, at most (the most recent ones). */
export const OPS_OCCURRENCE_LIST_CAP = 50;

const instantSchema = z.iso.datetime();
const countSchema = z.number().int().min(0);

// ---------------------------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------------------------

const probeWindowSchema = z.strictObject({
  checks: countSchema,
  failures: countSchema,
});
export type OpsProbeWindow = z.infer<typeof probeWindowSchema>;

export const OPS_AVAILABILITY_WINDOWS = ["day", "week", "month"] as const;

export const opsProbeSchema = z.strictObject({
  target: z.enum(OPS_PROBE_TARGETS),
  /** The latest check of the target, any instance; null before the first one. */
  last: z
    .strictObject({
      checkedAt: instantSchema,
      outcome: z.enum(["up", "down"]),
      statusCode: z.number().int().min(100).max(599).nullable(),
      failureCode: z.enum(OPS_PROBE_FAILURES).nullable(),
      durationMs: countSchema,
    })
    .nullable(),
  /** Checks and failures over the last 24 hours, 7 days and 30 days: availability = 1 - failures / checks. */
  availability: z.strictObject({
    day: probeWindowSchema,
    week: probeWindowSchema,
    month: probeWindowSchema,
  }),
});
export type OpsProbe = z.infer<typeof opsProbeSchema>;

/**
 * `running`: the latest beat is within the threshold of AL50; `silent`: it is older, or there never
 * was one (AL50 reads a worker that never beat as stopped); `unknown`: the threshold of AL50 is not
 * written, so nothing is evaluated (RG165, "non fixé").
 */
export const OPS_WORKER_STATES = ["running", "silent", "unknown"] as const;

export const opsWorkerProcessSchema = z.strictObject({
  instance: z.string().min(1).max(64),
  version: z.string().min(1).max(64),
  startedAt: instantSchema,
  beatAt: instantSchema,
  loopTurnAt: instantSchema,
  beatAgeSeconds: countSchema,
  loopTurnAgeSeconds: countSchema,
  /** This process's beat is older than the threshold of AL50; null when that threshold is not written. */
  silent: z.boolean().nullable(),
});

export const opsPeriodicRunSchema = z.strictObject({
  task: z.enum(OPS_PERIODIC_TASKS),
  /** `YYYY-MM-DD`, or `YYYY-MM-DDTHH` for an hourly task. */
  period: z.string().regex(/^\d{4}-\d{2}-\d{2}(?:T\d{2})?$/),
  startedAt: instantSchema,
  finishedAt: instantSchema.nullable(),
  outcome: z
    .string()
    .regex(/^[a-z_]{1,40}$/)
    .nullable(),
});

/** A flat key / value of an alert: a measured value, its threshold, an instant (15 RG165). */
export const opsAlertValueSchema = z.strictObject({
  key: z.string().regex(/^[A-Za-z][A-Za-z0-9_]{0,62}$/),
  value: z.union([z.string().max(100), z.number(), z.null()]),
});

export const opsAlertSchema = z.strictObject({
  /** AL49 to AL63 (the catalogue of 15 RG165). */
  code: z.string().regex(/^AL\d{1,3}$/),
  /** What the alert is about: a target, a service, a group, a run; opaque, '' for the alert alone. */
  subject: z.string().max(100),
  openedAt: instantSchema,
  lastNotifiedAt: instantSchema.nullable(),
  notifiedCount: countSchema,
  value: z.array(opsAlertValueSchema).max(30),
});
export type OpsAlert = z.infer<typeof opsAlertSchema>;

export const opsStatusResponseSchema = z.strictObject({
  now: instantSchema,
  probes: z.array(opsProbeSchema).max(OPS_PROBE_TARGETS.length),
  worker: z.strictObject({
    state: z.enum(OPS_WORKER_STATES),
    /** The threshold of AL50 (`heartbeat_max_age_seconds`); null when it is not written. */
    maxBeatAgeSeconds: countSchema.nullable(),
    processes: z.array(opsWorkerProcessSchema).max(20),
  }),
  periodic: z.array(opsPeriodicRunSchema).max(OPS_PERIODIC_TASKS.length),
  alerts: z.array(opsAlertSchema).max(100),
});
export type OpsStatusResponse = z.infer<typeof opsStatusResponseSchema>;

// ---------------------------------------------------------------------------------------------
// Error groups
// ---------------------------------------------------------------------------------------------

export const opsErrorsQuerySchema = z.strictObject({
  state: z.enum(OPS_ERROR_FILTERS).default("open"),
  source: z.enum(OPS_ERROR_SOURCES).optional(),
});
export type OpsErrorsQuery = z.infer<typeof opsErrorsQuerySchema>;

export const opsErrorGroupSchema = z.strictObject({
  id: z.uuid(),
  source: z.enum(OPS_ERROR_SOURCES),
  service: z.enum(OPS_SERVICES),
  errorType: z.string().min(1).max(80),
  /** The NORMALISED message of the group: identifiers, numbers and quoted values removed (02 §20.8). */
  message: z.string().min(1).max(500),
  /** A route model (`/v1/auth/verify-code`), never a URL; null outside a request. */
  route: z.string().max(200).nullable(),
  status: z.enum(OPS_ERROR_STATUSES),
  occurrenceCount: countSchema,
  regressionCount: countSchema,
  firstSeenAt: instantSchema,
  lastSeenAt: instantSchema,
  lastRegressedAt: instantSchema.nullable(),
  firstVersion: z.string().min(1).max(64),
  lastVersion: z.string().min(1).max(64),
  /** A fixed group that occurred again, still open: `regressionCount > 0` and new or acknowledged. */
  regression: z.boolean(),
});
export type OpsErrorGroup = z.infer<typeof opsErrorGroupSchema>;

export const opsErrorsResponseSchema = z.strictObject({
  state: z.enum(OPS_ERROR_FILTERS),
  source: z.enum(OPS_ERROR_SOURCES).nullable(),
  /** Every state, whatever the list asked: the chips of the screen. */
  counts: z.strictObject({
    new: countSchema,
    acknowledged: countSchema,
    fixed: countSchema,
    ignored: countSchema,
    regression: countSchema,
  }),
  groups: z.array(opsErrorGroupSchema).max(OPS_ERROR_LIST_CAP),
  /** More groups than the cap exist for this filter: the most recent ones are shown. */
  truncated: z.boolean(),
});
export type OpsErrorsResponse = z.infer<typeof opsErrorsResponseSchema>;

export const opsErrorParamsSchema = z.strictObject({ id: z.uuid() });
export type OpsErrorParams = z.infer<typeof opsErrorParamsSchema>;

export const opsOccurrenceSchema = z.strictObject({
  occurredAt: instantSchema,
  service: z.enum(OPS_SERVICES),
  version: z.string().min(1).max(64),
  route: z.string().max(200).nullable(),
  /** The way to the Railway logs. */
  requestId: z.uuid().nullable(),
  /** The uuid is enough to investigate (02 §20.8); never a name nor an address. */
  accountId: z.uuid().nullable(),
  message: z.string().min(1).max(500),
  /** The cleaned stack: frames of our code, paths made relative, values removed. */
  stack: z.string().max(4000).nullable(),
  userAgentSummary: z.string().max(120).nullable(),
});
export type OpsOccurrence = z.infer<typeof opsOccurrenceSchema>;

export const opsErrorDetailResponseSchema = z.strictObject({
  group: opsErrorGroupSchema,
  occurrences: z.array(opsOccurrenceSchema).max(OPS_OCCURRENCE_LIST_CAP),
});
export type OpsErrorDetailResponse = z.infer<
  typeof opsErrorDetailResponseSchema
>;

// ---------------------------------------------------------------------------------------------
// Traffic
// ---------------------------------------------------------------------------------------------

export const opsTrafficQuerySchema = z.strictObject({
  window: z.enum(OPS_TRAFFIC_WINDOWS).default("hour"),
});
export type OpsTrafficQuery = z.infer<typeof opsTrafficQuerySchema>;

/**
 * One time bucket of a route (or of every route): calls per minute over the bucket, the p95 of its
 * durations (the upper bound in ms of the histogram bucket that holds it; null when nothing was
 * measured; 5000 with `p95Beyond` when it falls in the last bucket, "more than 5 s"), the counts of
 * 5xx and 429. `open` is the bucket still in progress.
 */
export const opsTrafficPointSchema = z.strictObject({
  at: instantSchema,
  calls: countSchema,
  callsPerMinute: z.number().min(0),
  serverErrors: countSchema,
  throttled: countSchema,
  p95Ms: z.number().min(0).nullable(),
  p95Beyond: z.boolean(),
  open: z.boolean(),
});
export type OpsTrafficPoint = z.infer<typeof opsTrafficPointSchema>;

const trafficSummarySchema = z.strictObject({
  calls: countSchema,
  callsPerMinute: z.number().min(0),
  serverErrors: countSchema,
  throttled: countSchema,
  p95Ms: z.number().min(0).nullable(),
  p95Beyond: z.boolean(),
});
export type OpsTrafficSummary = z.infer<typeof trafficSummarySchema>;

export const opsTrafficRouteSchema = z.strictObject({
  method: z.enum(["GET", "POST", "PATCH", "PUT", "DELETE"]),
  /** A route MODEL, or `unmatched`. */
  route: z.string().min(1).max(200),
  summary: trafficSummarySchema,
  points: z.array(opsTrafficPointSchema).max(28),
});
export type OpsTrafficRoute = z.infer<typeof opsTrafficRouteSchema>;

export const OPS_TRAFFIC_ROUTE_CAP = 100;

export const opsTrafficResponseSchema = z.strictObject({
  window: z.enum(OPS_TRAFFIC_WINDOWS),
  now: instantSchema,
  from: instantSchema,
  bucketSeconds: z.number().int().min(1),
  /** Every route, added up: the curves of the head of the screen. */
  total: z.strictObject({
    summary: trafficSummarySchema,
    points: z.array(opsTrafficPointSchema).max(28),
  }),
  routes: z.array(opsTrafficRouteSchema).max(OPS_TRAFFIC_ROUTE_CAP),
});
export type OpsTrafficResponse = z.infer<typeof opsTrafficResponseSchema>;

// ---------------------------------------------------------------------------------------------
// Processes and database
// ---------------------------------------------------------------------------------------------

export const opsProcessSchema = z.strictObject({
  service: z.enum(["api", "worker"]),
  instance: z.string().min(1).max(64),
  lastMinute: instantSchema,
  ageSeconds: countSchema,
  eventLoopDelayP99Ms: z.number().min(0),
  eventLoopDelayMaxMs: z.number().min(0),
  rssBytes: countSchema,
  heapUsedBytes: countSchema,
  cpuPercent: z.number().min(0),
  hour: z.strictObject({
    samples: countSchema,
    eventLoopDelayP99AvgMs: z.number().min(0).nullable(),
    eventLoopDelayMaxMs: z.number().min(0).nullable(),
    rssMaxBytes: countSchema.nullable(),
    cpuMaxPercent: z.number().min(0).nullable(),
  }),
});
export type OpsProcess = z.infer<typeof opsProcessSchema>;

export const opsDatabaseSampleSchema = z.strictObject({
  minute: instantSchema,
  connections: countSchema,
  maxConnections: z.number().int().min(1),
});

export const opsProcessesResponseSchema = z.strictObject({
  now: instantSchema,
  processes: z.array(opsProcessSchema).max(40),
  database: z.strictObject({
    last: opsDatabaseSampleSchema.nullable(),
    lastAgeSeconds: countSchema.nullable(),
    peak24h: countSchema.nullable(),
    samples: z.array(opsDatabaseSampleSchema).max(60),
  }),
});
export type OpsProcessesResponse = z.infer<typeof opsProcessesResponseSchema>;
