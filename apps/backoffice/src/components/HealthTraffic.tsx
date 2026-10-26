"use client";

// Calls, p95 and error rate per route (docs/mvp/02 §20.5, "Temps de réponse et volume d'appels",
// §20.6 "Comment lire un ralentissement"; 21 §J9 commit 9). The p95 comes from the histograms
// ADDED UP over every instance by apps/api (two p95 do not add up, two histograms do): it is the
// upper bound of the bucket that holds it, shown as "≤ 500 ms" or "> 5 s", never as a measured
// value. A curve per figure and per route, with a gap where nothing was measured.
import {
  OPS_TRAFFIC_WINDOWS,
  type OpsTrafficPoint,
  type OpsTrafficResponse,
  type OpsTrafficRoute,
  type OpsTrafficWindow,
} from "@influx/contracts/backoffice-ops";
import { useCallback, useId, useMemo, useState } from "react";
import { messages } from "@/messages/fr";
import { HELP_CLASSES } from "./auth-classes";
import { readOpsTraffic } from "./backoffice-api";
import {
  FIELD_CLASSES,
  SELECT_CLASSES,
  SMALL_LABEL_CLASSES,
  TABLE_CLASSES,
  TABLE_WRAP_CLASSES,
  TABULAR_CLASSES,
  TD_CLASSES,
  TH_CLASSES,
} from "./bo-classes";
import { Curve, LoadGate, SectionFrame } from "./HealthParts";
import {
  curveValues,
  formatCount,
  formatErrorRate,
  formatAge,
  formatP95,
  formatPercent,
  formatRate,
  sortRoutes,
  type CurveKind,
  type RouteSort,
} from "./ops-view-model";
import { useOpsRead } from "./use-ops-read";
import { formatTime } from "./view-model";

const t = messages.health;
const tt = t.traffic;

const CURVES: readonly { kind: CurveKind; name: string }[] = [
  { kind: "calls", name: tt.curveCalls },
  { kind: "p95", name: tt.curveP95 },
  { kind: "errors", name: tt.curveErrors },
];

/** The words that tell a curve to a reader who does not see it: its last point and its maximum. */
function curveLabel(
  kind: CurveKind,
  name: string,
  points: readonly OpsTrafficPoint[],
): string {
  const values = curveValues(points, kind);
  const measured = values.filter((value): value is number => value !== null);
  if (measured.length === 0) {
    return tt.curveEmpty(name);
  }
  const last = points.at(-1);
  const format = (point: OpsTrafficPoint | undefined, value: number | null) => {
    if (point === undefined || value === null) {
      return messages.common.none;
    }
    switch (kind) {
      case "calls":
        return `${formatRate(value)} / min`;
      case "p95":
        return formatP95(point);
      default:
        return formatPercent(value);
    }
  };
  const peakIndex = values.findIndex(
    (value) => value === Math.max(...measured),
  );
  return tt.curveLabel(
    name,
    format(last, values.at(-1) ?? null),
    format(points[peakIndex], values[peakIndex] ?? null),
  );
}

function Curves({
  points,
  large,
}: {
  points: readonly OpsTrafficPoint[];
  large: boolean;
}) {
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      {CURVES.map(({ kind, name }) => (
        <Curve
          key={kind}
          large={large}
          values={curveValues(points, kind)}
          label={curveLabel(kind, name, points)}
        />
      ))}
    </span>
  );
}

function RouteRow({ route }: { route: OpsTrafficRoute }) {
  const { summary } = route;
  return (
    <tr>
      <th
        scope="row"
        className={`${TD_CLASSES} text-left font-regular break-all`}
      >
        <span className="font-semibold">{route.method}</span>{" "}
        <span className="font-mono">{route.route}</span>
        <span className={`block ${HELP_CLASSES}`}>
          {tt.callsTotal(summary.calls)}
        </span>
      </th>
      <td className={`${TD_CLASSES} ${TABULAR_CLASSES}`}>
        {formatRate(summary.callsPerMinute)}
      </td>
      <td className={`${TD_CLASSES} ${TABULAR_CLASSES}`}>
        {formatP95(summary)}
      </td>
      <td className={`${TD_CLASSES} ${TABULAR_CLASSES}`}>
        {tt.errorsCell(
          summary.serverErrors,
          formatErrorRate(summary.serverErrors, summary.calls),
        )}
      </td>
      <td className={`${TD_CLASSES} ${TABULAR_CLASSES}`}>
        {formatCount(summary.throttled)}
      </td>
      <td className={TD_CLASSES}>
        <Curves points={route.points} large={false} />
      </td>
    </tr>
  );
}

function ReadingGuide() {
  const guide = tt.read;
  return (
    <details className="text-sm">
      <summary className="cursor-pointer font-semibold text-text-primary">
        {guide.title}
      </summary>
      <div className={`${TABLE_WRAP_CLASSES} mt-2`}>
        <table className={TABLE_CLASSES}>
          <caption className="sr-only">{guide.title}</caption>
          <thead>
            <tr>
              {(["calls", "durations", "reading"] as const).map((key) => (
                <th key={key} scope="col" className={TH_CLASSES}>
                  {guide.columns[key]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {guide.rows.map(([calls, durations, reading]) => (
              <tr key={reading}>
                <td className={TD_CLASSES}>{calls}</td>
                <td className={TD_CLASSES}>{durations}</td>
                <td className={TD_CLASSES}>{reading}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className={`mt-2 ${HELP_CLASSES}`}>{guide.origin}</p>
    </details>
  );
}

function TrafficTable({
  traffic,
  sort,
}: {
  traffic: OpsTrafficResponse;
  sort: RouteSort;
}) {
  const routes = useMemo(
    () => sortRoutes(traffic.routes, sort),
    [traffic.routes, sort],
  );
  const { total } = traffic;
  if (total.summary.calls === 0 && routes.length === 0) {
    return <p className={HELP_CLASSES}>{tt.empty}</p>;
  }
  // each curve keeps its own scale (0 to its maximum): the figures of the table compare the routes
  return (
    <>
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex flex-col gap-1">
          <p className="font-semibold text-text-primary">{tt.total}</p>
          <p className={`${HELP_CLASSES} ${TABULAR_CLASSES}`}>
            {tt.totalLine(
              tt.callsTotal(total.summary.calls),
              formatRate(total.summary.callsPerMinute),
              formatP95(total.summary),
              formatErrorRate(total.summary.serverErrors, total.summary.calls),
            )}
          </p>
          <p className={HELP_CLASSES}>
            {tt.range(formatTime(traffic.from), formatTime(traffic.now))}{" "}
            {tt.bucket(formatAge(traffic.bucketSeconds))} {tt.inProgress}
          </p>
        </div>
        <Curves points={total.points} large />
      </div>
      <div className={TABLE_WRAP_CLASSES}>
        <table className={TABLE_CLASSES}>
          <caption className="sr-only">{tt.title}</caption>
          <thead>
            <tr>
              {(
                [
                  "route",
                  "calls",
                  "p95",
                  "errors",
                  "throttled",
                  "curves",
                ] as const
              ).map((key) => (
                <th key={key} scope="col" className={TH_CLASSES}>
                  {tt.columns[key]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {routes.map((route) => (
              <RouteRow key={`${route.method} ${route.route}`} route={route} />
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function TrafficSection({ refresh }: { refresh: number }) {
  const ids = { window: useId(), sort: useId() };
  const [window, setWindow] = useState<OpsTrafficWindow>("hour");
  const [sort, setSort] = useState<RouteSort>("calls");
  const read = useCallback(() => readOpsTraffic(window), [window]);
  const { load, retry } = useOpsRead(read, refresh);

  return (
    <SectionFrame title={tt.title} lead={tt.lead}>
      <div className="flex flex-wrap items-end gap-3">
        <div className={FIELD_CLASSES}>
          <label htmlFor={ids.window} className={SMALL_LABEL_CLASSES}>
            {tt.window}
          </label>
          <select
            id={ids.window}
            value={window}
            onChange={(event) =>
              setWindow(event.target.value as OpsTrafficWindow)
            }
            className={SELECT_CLASSES}
          >
            {OPS_TRAFFIC_WINDOWS.map((value) => (
              <option key={value} value={value}>
                {tt.windows[value]}
              </option>
            ))}
          </select>
        </div>
        <div className={FIELD_CLASSES}>
          <label htmlFor={ids.sort} className={SMALL_LABEL_CLASSES}>
            {tt.sort}
          </label>
          <select
            id={ids.sort}
            value={sort}
            onChange={(event) => setSort(event.target.value as RouteSort)}
            className={SELECT_CLASSES}
          >
            {(["calls", "p95", "errors"] as const).map((value) => (
              <option key={value} value={value}>
                {tt.sorts[value]}
              </option>
            ))}
          </select>
        </div>
      </div>
      <LoadGate load={load} retry={retry}>
        {(traffic) => <TrafficTable traffic={traffic} sort={sort} />}
      </LoadGate>
      <ReadingGuide />
    </SectionFrame>
  );
}
