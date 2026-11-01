"use client";

// The first three sections of the "Santé technique" screen, from one read (docs/mvp/02 §20.5, §11.3;
// 15 RG165): the availability measured by the probe, the open technical alerts, the worker and its
// periodic tasks. Read only. A state is a word with a symbol; the colour only reinforces it.
import {
  OPS_PROBE_TARGETS,
  type OpsAlert,
  type OpsProbe,
  type OpsStatusResponse,
} from "@influx/contracts/backoffice-ops";
import { messages } from "@/messages/fr";
import { HELP_CLASSES } from "./auth-classes";
import { readOpsStatus } from "./backoffice-api";
import {
  BLOCK_TITLE,
  TABLE_CLASSES,
  TABULAR_CLASSES,
  TD_CLASSES,
  TH_CLASSES,
} from "./bo-classes";
import { DenseTableRegion } from "./DenseTableRegion";
import { LoadGate, SectionFrame, StateText, type Tone } from "./HealthParts";
import {
  formatAge,
  formatAlertValue,
  formatAvailability,
  probeState,
  secondsSince,
  STALE_AFTER_SECONDS,
} from "./ops-view-model";
import { useOpsRead } from "./use-ops-read";
import { formatDateTime, formatTime } from "./view-model";

const t = messages.health;
const ta = t.availability;

function ProbeRow({ probe, now }: { probe: OpsProbe; now: string }) {
  const state = probeState(probe);
  const last = probe.last;
  const age = last === null ? null : secondsSince(now, last.checkedAt);
  const tone: Tone =
    state === "up" ? "ok" : state === "down" ? "bad" : "neutral";
  const failure =
    last === null || last.failureCode === null
      ? null
      : [
          ta.failures[last.failureCode],
          last.statusCode === null ? null : ta.statusCode(last.statusCode),
        ]
          .filter((part) => part !== null)
          .join(", ");
  return (
    <tr>
      <th scope="row" className={`${TD_CLASSES} text-left font-semibold`}>
        {ta.targets[probe.target]}
      </th>
      <td className={TD_CLASSES}>
        <StateText tone={tone}>{ta[state]}</StateText>
        {failure === null ? null : <span>{ta.cause(failure)}</span>}
        {age === null ? null : (
          <span className={HELP_CLASSES}>{t.afterState(formatAge(age))}</span>
        )}
        {age !== null && age > STALE_AFTER_SECONDS ? (
          <>
            {" "}
            <StateText tone="warn">{ta.stale}</StateText>
          </>
        ) : null}
      </td>
      <td className={`${TD_CLASSES} ${TABULAR_CLASSES}`}>
        {last === null ? messages.common.none : `${last.durationMs} ms`}
      </td>
      {(["day", "week", "month"] as const).map((key) => {
        const window = probe.availability[key];
        return (
          <td key={key} className={`${TD_CLASSES} ${TABULAR_CLASSES}`}>
            {window.checks === 0
              ? messages.common.none
              : ta.window(
                  formatAvailability(window),
                  window.failures,
                  window.checks,
                )}
          </td>
        );
      })}
    </tr>
  );
}

function Availability({ status }: { status: OpsStatusResponse }) {
  const probes = [...status.probes].sort(
    (left, right) =>
      OPS_PROBE_TARGETS.indexOf(left.target) -
      OPS_PROBE_TARGETS.indexOf(right.target),
  );
  const measured = probes.some((probe) => probe.last !== null);
  return (
    <>
      <DenseTableRegion label={ta.title}>
        <table className={TABLE_CLASSES}>
          <caption className="sr-only">{ta.title}</caption>
          <thead>
            <tr>
              {(
                ["target", "state", "duration", "day", "week", "month"] as const
              ).map((key) => (
                <th key={key} scope="col" className={TH_CLASSES}>
                  {ta.columns[key]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {probes.map((probe) => (
              <ProbeRow key={probe.target} probe={probe} now={status.now} />
            ))}
          </tbody>
        </table>
      </DenseTableRegion>
      {measured ? null : <p className={HELP_CLASSES}>{ta.noMeasure}</p>}
    </>
  );
}

function AlertRow({ alert, now }: { alert: OpsAlert; now: string }) {
  const tl = t.alerts;
  return (
    <tr>
      <th scope="row" className={`${TD_CLASSES} text-left`}>
        <span className="font-semibold">{alert.code}</span>{" "}
        {tl.titles[alert.code] ?? tl.untitled}
        {alert.subject === "" ? null : (
          <span className={`block ${HELP_CLASSES}`}>
            {tl.subject(alert.subject)}
          </span>
        )}
      </th>
      <td className={`${TD_CLASSES} ${TABULAR_CLASSES}`}>
        {formatDateTime(alert.openedAt)}
        <span className={`block ${HELP_CLASSES}`}>
          {t.ago(formatAge(secondsSince(now, alert.openedAt)))}
        </span>
      </td>
      <td className={`${TD_CLASSES} ${TABULAR_CLASSES}`}>
        {alert.lastNotifiedAt === null
          ? tl.notNotified
          : tl.notified(
              formatDateTime(alert.lastNotifiedAt),
              alert.notifiedCount,
            )}
      </td>
      <td className={TD_CLASSES}>
        {alert.value.length === 0 ? (
          messages.common.none
        ) : (
          <dl className="flex flex-wrap gap-x-4 gap-y-1">
            {alert.value.map((entry) => (
              <div key={entry.key} className="flex gap-1">
                <dt className="font-mono text-text-secondary">{entry.key}</dt>
                <dd className={`font-mono ${TABULAR_CLASSES}`}>
                  {formatAlertValue(entry.value)}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </td>
    </tr>
  );
}

function Alerts({ status }: { status: OpsStatusResponse }) {
  const tl = t.alerts;
  if (status.alerts.length === 0) {
    return (
      <p>
        <StateText tone="ok">{tl.empty}</StateText>
      </p>
    );
  }
  return (
    <DenseTableRegion label={tl.title}>
      <table className={TABLE_CLASSES}>
        <caption className="sr-only">{tl.title}</caption>
        <thead>
          <tr>
            {(["alert", "since", "notified", "value"] as const).map((key) => (
              <th key={key} scope="col" className={TH_CLASSES}>
                {tl.columns[key]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {status.alerts.map((alert) => (
            <AlertRow
              key={`${alert.code}-${alert.subject}`}
              alert={alert}
              now={status.now}
            />
          ))}
        </tbody>
      </table>
    </DenseTableRegion>
  );
}

function Processes({ status }: { status: OpsStatusResponse }) {
  const tw = t.worker;
  if (status.worker.processes.length === 0) {
    return <p className={HELP_CLASSES}>{tw.noBeat}</p>;
  }
  return (
    <DenseTableRegion label={tw.title}>
      <table className={TABLE_CLASSES}>
        <caption className="sr-only">{tw.title}</caption>
        <thead>
          <tr>
            {(
              [
                "instance",
                "version",
                "started",
                "beat",
                "turn",
                "state",
              ] as const
            ).map((key) => (
              <th key={key} scope="col" className={TH_CLASSES}>
                {tw.columns[key]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {status.worker.processes.map((process) => (
            <tr key={`${process.instance}-${process.startedAt}`}>
              <th scope="row" className={`${TD_CLASSES} text-left font-mono`}>
                {process.instance}
              </th>
              <td className={`${TD_CLASSES} font-mono`}>{process.version}</td>
              <td className={`${TD_CLASSES} ${TABULAR_CLASSES}`}>
                {formatDateTime(process.startedAt)}
              </td>
              <td className={`${TD_CLASSES} ${TABULAR_CLASSES}`}>
                {t.timeAndAge(
                  formatTime(process.beatAt),
                  formatAge(process.beatAgeSeconds),
                )}
              </td>
              <td className={`${TD_CLASSES} ${TABULAR_CLASSES}`}>
                {t.timeAndAge(
                  formatTime(process.loopTurnAt),
                  formatAge(process.loopTurnAgeSeconds),
                )}
              </td>
              <td className={TD_CLASSES}>
                {process.silent === null ? (
                  <StateText tone="warn">{tw.notEvaluated}</StateText>
                ) : process.silent ? (
                  <StateText tone="bad">{tw.silent}</StateText>
                ) : (
                  <StateText tone="ok">{tw.beating}</StateText>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </DenseTableRegion>
  );
}

function PeriodicTasks({ status }: { status: OpsStatusResponse }) {
  const tw = t.worker;
  if (status.periodic.length === 0) {
    return <p className={HELP_CLASSES}>{tw.tasks.empty}</p>;
  }
  return (
    <DenseTableRegion label={tw.tasks.title}>
      <table className={TABLE_CLASSES}>
        <caption className="sr-only">{tw.tasks.title}</caption>
        <thead>
          <tr>
            {(
              ["task", "period", "started", "finished", "outcome"] as const
            ).map((key) => (
              <th key={key} scope="col" className={TH_CLASSES}>
                {tw.tasks.columns[key]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {status.periodic.map((run) => (
            <tr key={run.task}>
              <th scope="row" className={`${TD_CLASSES} text-left`}>
                {tw.tasks.names[run.task]}
              </th>
              <td className={`${TD_CLASSES} font-mono`}>{run.period}</td>
              <td className={`${TD_CLASSES} ${TABULAR_CLASSES}`}>
                {formatDateTime(run.startedAt)}
              </td>
              <td className={`${TD_CLASSES} ${TABULAR_CLASSES}`}>
                {run.finishedAt === null
                  ? messages.common.none
                  : formatDateTime(run.finishedAt)}
              </td>
              <td className={TD_CLASSES}>
                {run.outcome === null ? (
                  <StateText tone="neutral">{tw.tasks.running}</StateText>
                ) : (
                  <StateText tone={run.outcome === "succeeded" ? "ok" : "bad"}>
                    {tw.tasks.outcomes[run.outcome] ?? run.outcome}
                  </StateText>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </DenseTableRegion>
  );
}

function Worker({ status }: { status: OpsStatusResponse }) {
  const tw = t.worker;
  const { worker } = status;
  const tone: Tone =
    worker.state === "running"
      ? "ok"
      : worker.state === "silent"
        ? "bad"
        : "warn";
  return (
    <>
      <p>
        <StateText tone={tone}>{tw.state[worker.state]}</StateText>
      </p>
      {worker.maxBeatAgeSeconds === null ? null : (
        <p className={HELP_CLASSES}>{tw.threshold(worker.maxBeatAgeSeconds)}</p>
      )}
      <Processes status={status} />
      <p className={HELP_CLASSES}>{tw.turnHint}</p>
      <h3 className={BLOCK_TITLE}>{tw.tasks.title}</h3>
      <PeriodicTasks status={status} />
    </>
  );
}

export function StatusSections({ refresh }: { refresh: number }) {
  const { load, retry } = useOpsRead(readOpsStatus, refresh);
  return (
    <>
      <SectionFrame title={ta.title} lead={ta.lead}>
        <LoadGate load={load} retry={retry}>
          {(status) => <Availability status={status} />}
        </LoadGate>
      </SectionFrame>
      <SectionFrame title={t.alerts.title} lead={t.alerts.lead}>
        <LoadGate load={load} retry={retry}>
          {(status) => <Alerts status={status} />}
        </LoadGate>
      </SectionFrame>
      <SectionFrame title={t.worker.title} lead={t.worker.lead}>
        <LoadGate load={load} retry={retry}>
          {(status) => <Worker status={status} />}
        </LoadGate>
      </SectionFrame>
    </>
  );
}
