"use client";

// The health of the processes and the connections of the base (docs/mvp/02 §20.5, "Temps de
// réponse et volume d'appels"; 21 §J9 commit 9). The delay of the event loop is the most direct
// sign of slowness of a Node service; the connections are read every minute by the worker. A
// reading older than three minutes is said to be old: a recorder that stopped must not look calm.
import type {
  OpsProcess,
  OpsProcessesResponse,
} from "@influx/contracts/backoffice-ops";
import { messages } from "@/messages/fr";
import { HELP_CLASSES } from "./auth-classes";
import { readOpsProcesses } from "./backoffice-api";
import {
  TABLE_CLASSES,
  TABULAR_CLASSES,
  TD_CLASSES,
  TH_CLASSES,
} from "./bo-classes";
import { DenseTableRegion } from "./DenseTableRegion";
import { Curve, LoadGate, SectionFrame, StateText } from "./HealthParts";
import {
  connectionShare,
  formatAge,
  formatBytes,
  formatMs,
  formatPercent,
  STALE_AFTER_SECONDS,
} from "./ops-view-model";
import { useOpsRead } from "./use-ops-read";
import { formatTime } from "./view-model";

const t = messages.health;
const tp = t.processes;

function ProcessRow({ process }: { process: OpsProcess }) {
  const stale = process.ageSeconds > STALE_AFTER_SECONDS;
  const { hour } = process;
  return (
    <tr>
      <th scope="row" className={`${TD_CLASSES} text-left font-regular`}>
        <span className="font-semibold">{tp.services[process.service]}</span>{" "}
        <span className="font-mono">{process.instance}</span>
      </th>
      <td className={`${TD_CLASSES} ${TABULAR_CLASSES}`}>
        {t.timeAndAge(
          formatTime(process.lastMinute),
          formatAge(process.ageSeconds),
        )}
        {stale ? (
          <>
            {" "}
            <StateText tone="warn">{tp.stale}</StateText>
          </>
        ) : null}
      </td>
      <td className={`${TD_CLASSES} ${TABULAR_CLASSES}`}>
        {formatMs(process.eventLoopDelayP99Ms)}
      </td>
      <td className={`${TD_CLASSES} ${TABULAR_CLASSES}`}>
        {hour.eventLoopDelayP99AvgMs === null ||
        hour.eventLoopDelayMaxMs === null
          ? messages.common.none
          : tp.loopHour(
              formatMs(hour.eventLoopDelayP99AvgMs),
              formatMs(hour.eventLoopDelayMaxMs),
            )}
      </td>
      <td className={`${TD_CLASSES} ${TABULAR_CLASSES}`}>
        {formatBytes(process.rssBytes)}
        {hour.rssMaxBytes === null ? null : (
          <span className={`block ${HELP_CLASSES}`}>
            {tp.peak(formatBytes(hour.rssMaxBytes))}
          </span>
        )}
      </td>
      <td className={`${TD_CLASSES} ${TABULAR_CLASSES}`}>
        {formatPercent(process.cpuPercent)}
        {hour.cpuMaxPercent === null ? null : (
          <span className={`block ${HELP_CLASSES}`}>
            {tp.peak(formatPercent(hour.cpuMaxPercent))}
          </span>
        )}
      </td>
    </tr>
  );
}

function Database({
  database,
}: {
  database: OpsProcessesResponse["database"];
}) {
  const td = tp.database;
  const { last } = database;
  if (last === null) {
    return <p className={HELP_CLASSES}>{td.none}</p>;
  }
  const values = database.samples.map((sample) => sample.connections);
  const peak = Math.max(0, ...values);
  const stale =
    database.lastAgeSeconds !== null &&
    database.lastAgeSeconds > STALE_AFTER_SECONDS;
  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="flex flex-col gap-1">
        <p className={`font-semibold text-text-primary ${TABULAR_CLASSES}`}>
          {td.now(
            last.connections,
            last.maxConnections,
            connectionShare(last.connections, last.maxConnections),
          )}
        </p>
        {database.peak24h === null ? null : (
          <p className={`${HELP_CLASSES} ${TABULAR_CLASSES}`}>
            {td.peak(database.peak24h)}
          </p>
        )}
        {stale && database.lastAgeSeconds !== null ? (
          <p>
            <StateText tone="warn">
              {td.stale(formatAge(database.lastAgeSeconds))}
            </StateText>
          </p>
        ) : null}
      </div>
      <Curve
        large
        values={values}
        ceiling={last.maxConnections}
        label={td.curveLabel(last.connections, peak)}
      />
    </div>
  );
}

export function ProcessesSection({ refresh }: { refresh: number }) {
  const { load, retry } = useOpsRead(readOpsProcesses, refresh);
  return (
    <SectionFrame title={tp.title} lead={tp.lead}>
      <LoadGate load={load} retry={retry}>
        {(answer) => (
          <>
            {answer.processes.length === 0 ? (
              <p className={HELP_CLASSES}>{tp.empty}</p>
            ) : (
              <DenseTableRegion label={tp.title}>
                <table className={TABLE_CLASSES}>
                  <caption className="sr-only">{tp.title}</caption>
                  <thead>
                    <tr>
                      {(
                        [
                          "process",
                          "last",
                          "loop",
                          "loopHour",
                          "memory",
                          "cpu",
                        ] as const
                      ).map((key) => (
                        <th key={key} scope="col" className={TH_CLASSES}>
                          {tp.columns[key]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {answer.processes.map((process) => (
                      <ProcessRow
                        key={`${process.service}-${process.instance}`}
                        process={process}
                      />
                    ))}
                  </tbody>
                </table>
              </DenseTableRegion>
            )}
            <h3 className="text-sm font-semibold text-text-primary">
              {tp.database.title}
            </h3>
            <Database database={answer.database} />
          </>
        )}
      </LoadGate>
    </SectionFrame>
  );
}
