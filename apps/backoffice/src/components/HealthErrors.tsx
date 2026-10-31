"use client";

// The error groups of the "Santé technique" screen (docs/mvp/02 §20.5, "Erreurs serveur" and
// "Erreurs du navigateur"; 21 §J9 commit 9). One state at a time (the open ones by default), one
// origin, a group opened on demand to see its kept occurrences. Read only: classifying a group is
// not part of this screen. What is shown is the NORMALISED message of a group and the cleaned
// message and stack of an occurrence (02 §20.8), always as plain text. J9S-7: the message of a
// browser group is free text written by a member's browser: it carries the note "source navigateur,
// texte non vérifié" and stays inert text (no link, no `href`, no HTML), whatever it contains.
import {
  OPS_ERROR_FILTERS,
  OPS_ERROR_SOURCES,
  type OpsErrorFilter,
  type OpsErrorGroup,
  type OpsErrorsResponse,
  type OpsOccurrence,
} from "@influx/contracts/backoffice-ops";
import { Fragment, useCallback, useId, useState } from "react";
import { messages } from "@/messages/fr";
import { HELP_CLASSES } from "./auth-classes";
import { readOpsError, readOpsErrors } from "./backoffice-api";
import {
  FIELD_CLASSES,
  MONO_CLASSES,
  SELECT_CLASSES,
  SMALL_LABEL_CLASSES,
  SMALL_PRIMARY_CLASSES,
  SMALL_SECONDARY_CLASSES,
  TABLE_CLASSES,
  TABULAR_CLASSES,
  TD_CLASSES,
  TH_CLASSES,
} from "./bo-classes";
import { DenseTableRegion } from "./DenseTableRegion";
import { LoadGate, SectionFrame, StateText, type Tone } from "./HealthParts";
import { formatCount } from "./ops-view-model";
import { useOpsRead } from "./use-ops-read";
import { formatDateTime } from "./view-model";

const t = messages.health;
const te = t.errors;

type SourceChoice = "all" | (typeof OPS_ERROR_SOURCES)[number];

/** The count behind a chip, from the counts of the answer (they follow the origin, not the state). */
function countOf(
  filter: OpsErrorFilter,
  counts: OpsErrorsResponse["counts"],
): number {
  switch (filter) {
    case "open":
      return counts.new + counts.acknowledged;
    case "all":
      return counts.new + counts.acknowledged + counts.fixed + counts.ignored;
    default:
      return counts[filter];
  }
}

function groupState(group: OpsErrorGroup): { tone: Tone; label: string } {
  if (group.regression) {
    return { tone: "bad", label: te.regression(group.regressionCount) };
  }
  switch (group.status) {
    case "new":
      return { tone: "warn", label: te.statuses.new };
    case "fixed":
      return { tone: "ok", label: te.statuses.fixed };
    default:
      return { tone: "neutral", label: te.statuses[group.status] };
  }
}

/** The note that goes with a message whose source is a member's browser (J9S-7). */
function UnverifiedNote({ source }: { source: OpsErrorGroup["source"] }) {
  return source === "browser" ? (
    <span className={`block ${HELP_CLASSES}`}>{te.unverified}</span>
  ) : null;
}

export function OccurrenceRows({
  occurrence,
  source,
}: {
  occurrence: OpsOccurrence;
  source: OpsErrorGroup["source"];
}) {
  const td = te.detailColumns;
  return (
    <>
      <tr>
        <td className={`${TD_CLASSES} ${TABULAR_CLASSES}`}>
          {formatDateTime(occurrence.occurredAt)}
        </td>
        <td className={TD_CLASSES}>{te.services[occurrence.service]}</td>
        <td className={`${TD_CLASSES} font-mono`}>{occurrence.version}</td>
        <td className={`${TD_CLASSES} font-mono break-all`}>
          {occurrence.route ?? te.noRoute}
        </td>
        <td className={TD_CLASSES}>
          {occurrence.requestId === null ? (
            messages.common.none
          ) : (
            <span aria-label={td.request} className={MONO_CLASSES}>
              {occurrence.requestId}
            </span>
          )}
        </td>
        <td className={TD_CLASSES}>
          {occurrence.accountId === null ? (
            messages.common.none
          ) : (
            <span aria-label={td.account} className={MONO_CLASSES}>
              {occurrence.accountId}
            </span>
          )}
        </td>
        <td className={`${TD_CLASSES} break-words`}>
          {occurrence.message}
          <UnverifiedNote source={source} />
          {occurrence.userAgentSummary === null ? null : (
            <span className={`block ${HELP_CLASSES}`}>
              {te.userAgent(occurrence.userAgentSummary)}
            </span>
          )}
        </td>
      </tr>
      {occurrence.stack === null ? null : (
        <tr>
          <td colSpan={7} className={TD_CLASSES}>
            <details>
              <summary className="cursor-pointer text-text-secondary">
                {te.stack}
              </summary>
              <pre className="font-mono text-sm break-words whitespace-pre-wrap text-text-primary">
                {occurrence.stack}
              </pre>
            </details>
          </td>
        </tr>
      )}
    </>
  );
}

function GroupDetail({
  group,
  refresh,
}: {
  group: OpsErrorGroup;
  refresh: number;
}) {
  const read = useCallback(() => readOpsError(group.id), [group.id]);
  const { load, retry } = useOpsRead(read, refresh);
  return (
    <div
      className="flex flex-col gap-2"
      role="region"
      aria-label={te.detailTitle(group.errorType)}
    >
      <p className={HELP_CLASSES}>{te.detailLead}</p>
      <LoadGate load={load} retry={retry}>
        {(detail) =>
          detail.occurrences.length === 0 ? (
            <p className={HELP_CLASSES}>{te.detailEmpty}</p>
          ) : (
            <DenseTableRegion label={te.detailTitle(group.errorType)}>
              <table className={TABLE_CLASSES}>
                <caption className="sr-only">
                  {te.detailTitle(group.errorType)}
                </caption>
                <thead>
                  <tr>
                    {(
                      [
                        "when",
                        "service",
                        "version",
                        "route",
                        "request",
                        "account",
                        "message",
                      ] as const
                    ).map((key) => (
                      <th key={key} scope="col" className={TH_CLASSES}>
                        {te.detailColumns[key]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {detail.occurrences.map((occurrence) => (
                    <OccurrenceRows
                      key={`${occurrence.occurredAt}-${occurrence.requestId ?? ""}-${occurrence.message}`}
                      occurrence={occurrence}
                      source={group.source}
                    />
                  ))}
                </tbody>
              </table>
            </DenseTableRegion>
          )
        }
      </LoadGate>
    </div>
  );
}

export function GroupRows({
  group,
  open,
  onToggle,
  refresh,
}: {
  group: OpsErrorGroup;
  open: boolean;
  onToggle: () => void;
  refresh: number;
}) {
  const detailId = useId();
  const state = groupState(group);
  return (
    <Fragment>
      <tr>
        <td className={TD_CLASSES}>
          <StateText tone={state.tone}>{state.label}</StateText>
        </td>
        <th
          scope="row"
          className={`${TD_CLASSES} text-left font-regular break-words`}
        >
          <span className="block font-semibold">{group.errorType}</span>
          {group.message}
          <UnverifiedNote source={group.source} />
        </th>
        <td className={`${TD_CLASSES} font-mono break-all`}>
          {group.route ?? te.noRoute}
        </td>
        <td className={TD_CLASSES}>{te.services[group.service]}</td>
        <td className={`${TD_CLASSES} ${TABULAR_CLASSES}`}>
          {formatCount(group.occurrenceCount)}
        </td>
        <td className={`${TD_CLASSES} ${TABULAR_CLASSES}`}>
          {formatDateTime(group.firstSeenAt)}
        </td>
        <td className={`${TD_CLASSES} ${TABULAR_CLASSES}`}>
          {formatDateTime(group.lastSeenAt)}
        </td>
        <td className={`${TD_CLASSES} font-mono`}>
          {te.versions(group.firstVersion, group.lastVersion)}
        </td>
        <td className={TD_CLASSES}>
          <button
            type="button"
            aria-expanded={open}
            aria-controls={detailId}
            onClick={onToggle}
            className={SMALL_SECONDARY_CLASSES}
          >
            {open ? te.hide : te.show}
          </button>
        </td>
      </tr>
      {open ? (
        <tr>
          <td colSpan={9} id={detailId} className={TD_CLASSES}>
            <GroupDetail group={group} refresh={refresh} />
          </td>
        </tr>
      ) : null}
    </Fragment>
  );
}

export function ErrorsSection({ refresh }: { refresh: number }) {
  const ids = { source: useId() };
  const [filter, setFilter] = useState<OpsErrorFilter>("open");
  const [source, setSource] = useState<SourceChoice>("all");
  const [opened, setOpened] = useState<string | null>(null);
  const read = useCallback(
    () => readOpsErrors(filter, source === "all" ? null : source),
    [filter, source],
  );
  const { load, retry } = useOpsRead(read, refresh);
  const counts = load.kind === "ok" ? load.data.counts : null;

  return (
    <SectionFrame title={te.title} lead={te.lead}>
      <div className="flex flex-wrap items-end gap-3">
        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-label={te.filter}
        >
          {OPS_ERROR_FILTERS.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={filter === value}
              onClick={() => {
                setFilter(value);
                setOpened(null);
              }}
              className={
                filter === value
                  ? SMALL_PRIMARY_CLASSES
                  : SMALL_SECONDARY_CLASSES
              }
            >
              {te.chip(
                te.filters[value],
                counts === null ? null : countOf(value, counts),
              )}
            </button>
          ))}
        </div>
        <div className={FIELD_CLASSES}>
          <label htmlFor={ids.source} className={SMALL_LABEL_CLASSES}>
            {te.source}
          </label>
          <select
            id={ids.source}
            value={source}
            onChange={(event) => {
              setSource(event.target.value as SourceChoice);
              setOpened(null);
            }}
            className={SELECT_CLASSES}
          >
            {(["all", ...OPS_ERROR_SOURCES] as const).map((value) => (
              <option key={value} value={value}>
                {te.sources[value]}
              </option>
            ))}
          </select>
        </div>
      </div>
      <LoadGate load={load} retry={retry}>
        {(answer) =>
          answer.groups.length === 0 ? (
            <p>
              <StateText
                tone={
                  filter === "open" || filter === "regression"
                    ? "ok"
                    : "neutral"
                }
              >
                {filter === "open"
                  ? te.empty.open
                  : filter === "regression"
                    ? te.empty.regression
                    : te.empty.other}
              </StateText>
            </p>
          ) : (
            <>
              <DenseTableRegion label={te.title}>
                <table className={TABLE_CLASSES}>
                  <caption className="sr-only">{te.title}</caption>
                  <thead>
                    <tr>
                      {(
                        [
                          "status",
                          "error",
                          "route",
                          "service",
                          "count",
                          "first",
                          "last",
                          "versions",
                        ] as const
                      ).map((key) => (
                        <th key={key} scope="col" className={TH_CLASSES}>
                          {te.columns[key]}
                        </th>
                      ))}
                      <th scope="col" className={TH_CLASSES}>
                        <span className="sr-only">{te.columns.detail}</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {answer.groups.map((group) => (
                      <GroupRows
                        key={group.id}
                        group={group}
                        open={opened === group.id}
                        onToggle={() =>
                          setOpened(opened === group.id ? null : group.id)
                        }
                        refresh={refresh}
                      />
                    ))}
                  </tbody>
                </table>
              </DenseTableRegion>
              {answer.truncated ? (
                <p className={HELP_CLASSES}>
                  {te.truncated(answer.groups.length)}
                </p>
              ) : null}
            </>
          )
        }
      </LoadGate>
    </SectionFrame>
  );
}
