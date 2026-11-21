"use client";

// The results of the identified search (docs/mvp/10 RG71, RG76, RG77; 17b §3.3; jalons/l3g/modele.md §1, §8; L3G-12):
// the facets applied as chips that each take one away, the exact count, the sort, a semantic table (name and alias on
// two lines, the handle as a link that opens outside INFLUX, the audience, the badges, the state in words, the agent
// in charge), the explanation under each row and the exact values folded, the states (loading, none, refused), the
// pages. No box to tick (the multiple selection comes with « Proposer », Lot 4, Q3), no export, no infinite scroll, no
// tariff (D78). A row blocked with the brand of the campaign says its sentence and nothing else: never the motive nor
// the author (RG71). It only draws: the rules are the database's.
import type { IdentifiedCreatorSearchResponse } from "@influx/contracts/identified-creator-search";
import { messages } from "@/messages/fr";
import { HELP_CLASSES } from "./auth-classes";
import {
  BLOCK_TITLE,
  LINK_CLASSES,
  SELECT_CLASSES,
  SMALL_SECONDARY_CLASSES,
  TABLE_CLASSES,
  TD_CLASSES,
  TH_CLASSES,
  rowClasses,
} from "./bo-classes";
import { DenseTableRegion } from "./DenseTableRegion";
import { ErrorNotice } from "./ErrorNotice";
import { BanIcon, ExternalLinkIcon, TriangleAlertIcon } from "./icons";
import {
  criteriaOf,
  sortOf,
  sortOptions,
  wideningOf,
  rowViewOf,
  type Criterion,
  type Filters,
  type RowView,
} from "./identified-search-view";
import type { CreatorSearchSort } from "@influx/contracts/creator-search";

const t = messages.identifiedSearch;

export type SearchLoad =
  | { kind: "loading" }
  | { kind: "ok"; response: IdentifiedCreatorSearchResponse }
  | { kind: "error"; text: string };

const CHIP_CLASSES =
  "inline-flex min-h-(--size-bo-control) items-center gap-2 rounded-pill border-(length:--border-width-thin) border-border-strong bg-surface-raised px-3 text-sm text-text-primary";

/** The facets applied, one chip each: its button names the facet it takes away. */
function Chips({
  filters,
  onRemove,
}: {
  filters: Filters;
  onRemove: (criterion: Criterion) => void;
}) {
  const criteria = criteriaOf(filters);
  if (criteria.length === 0) {
    return null;
  }
  return (
    <ul aria-label={t.criteria.label} className="flex flex-wrap gap-2">
      {criteria.map((criterion) => (
        <li key={criterion.id} data-criterion={criterion.id}>
          <span className={CHIP_CLASSES}>
            {criterion.text}
            <button
              type="button"
              onClick={() => onRemove(criterion)}
              aria-label={t.criteria.remove(criterion.text)}
              className="rounded-pill px-1 font-semibold underline"
            >
              {t.criteria.removeShort}
            </button>
          </span>
        </li>
      ))}
    </ul>
  );
}

function Handles({ view }: { view: RowView }) {
  return (
    <ul className="flex flex-col gap-1">
      {view.handles.map((handle, at) => (
        <li key={`${handle.network}-${at}`} className="text-sm">
          <span className="text-text-secondary">{handle.network} </span>
          {handle.text === null ? (
            <span className="text-text-secondary">{t.row.noHandle}</span>
          ) : handle.href === null ? (
            <span>{handle.text}</span>
          ) : (
            <a
              href={handle.href}
              target="_blank"
              rel="noopener noreferrer"
              className={`${LINK_CLASSES} inline-flex items-center gap-1`}
            >
              {handle.text}
              <ExternalLinkIcon
                aria-hidden="true"
                className="size-(--size-icon-sm) shrink-0"
              />
              <span className="sr-only">{t.row.opensOutside}</span>
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}

function StateCell({ view }: { view: RowView }) {
  return (
    <div className="flex flex-col gap-1 text-sm">
      <span className="inline-flex items-center gap-1">
        {view.unpublished ? (
          <TriangleAlertIcon
            aria-hidden="true"
            className="size-(--size-icon-sm) shrink-0 text-feedback-warning-icon"
          />
        ) : null}
        <span className={view.unpublished ? "text-feedback-warning-text" : ""}>
          {view.unpublished ? `${t.unpublished} · ${view.state}` : view.state}
        </span>
      </span>
      {view.blocked ? (
        <span className="inline-flex items-center gap-1 text-feedback-error-text">
          <BanIcon
            aria-hidden="true"
            className="size-(--size-icon-sm) shrink-0 text-feedback-error-icon"
          />
          <span>{t.row.blockedState}</span>
        </span>
      ) : null}
    </div>
  );
}

/** A creator: its row, then the line under it that explains why it comes and holds the exact values folded. */
function CreatorRows({ view }: { view: RowView }) {
  return (
    <tbody data-creator-row={view.alias}>
      <tr className={rowClasses(false)}>
        <td className={TD_CLASSES}>
          <div className="flex flex-col gap-1">
            <span className="font-semibold">{view.legalName}</span>
            <span className="text-sm text-text-secondary">{view.alias}</span>
            <Handles view={view} />
          </div>
        </td>
        <td className={`${TD_CLASSES} tabular-nums`}>
          {view.audience.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </td>
        <td className={TD_CLASSES}>
          {view.badges.length === 0 ? (
            <span className="text-sm text-text-secondary">{t.row.noBadge}</span>
          ) : (
            <ul className="flex flex-col gap-1 text-sm">
              {view.badges.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          )}
        </td>
        <td className={TD_CLASSES}>
          <StateCell view={view} />
        </td>
        <td className={TD_CLASSES}>{view.owner}</td>
      </tr>
      <tr>
        <td
          colSpan={5}
          className="border-b-(length:--border-width-thin) border-border-subtle px-(--spacing-bo-cell-x) py-(--spacing-bo-cell-y) text-sm text-text-secondary"
        >
          {view.blocked ? (
            <p className="font-semibold text-feedback-error-text">
              {t.row.blockedPhrase}
            </p>
          ) : null}
          <p>{t.row.why(view.why)}</p>
          {view.vigilance === null ? null : <p>{view.vigilance}</p>}
          <details className="mt-1">
            <summary className="min-h-(--size-bo-control) cursor-pointer text-text-primary">
              {t.row.exactValues}
            </summary>
            <ul className="flex flex-col gap-1 pb-1 tabular-nums">
              {view.exact.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </details>
        </td>
      </tr>
    </tbody>
  );
}

function Skeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-1">
      {[0, 1, 2, 3].map((at) => (
        <div
          key={at}
          className="h-(--spacing-bo-row-h) rounded-md bg-surface-card"
        />
      ))}
    </div>
  );
}

export function IdentifiedResults({
  filters,
  sort,
  load,
  onRemove,
  onSort,
  onPage,
  onRetry,
}: {
  filters: Filters;
  sort: CreatorSearchSort;
  load: SearchLoad;
  onRemove: (criterion: Criterion) => void;
  onSort: (sort: CreatorSearchSort) => void;
  onPage: (page: number) => void;
  onRetry: () => void;
}) {
  return (
    <section
      aria-label={t.results.label}
      aria-busy={load.kind === "loading"}
      className="flex min-w-0 flex-col gap-3"
    >
      <Chips filters={filters} onRemove={onRemove} />
      {load.kind === "loading" ? (
        <>
          <p role="status" className={HELP_CLASSES}>
            {t.results.loading}
          </p>
          <Skeleton />
        </>
      ) : null}
      {load.kind === "error" ? (
        <div className="flex flex-col gap-2">
          <ErrorNotice>
            <p className="font-semibold">{t.failures.unavailable}</p>
            <p>{load.text}</p>
            <p>{t.failures.keptNote}</p>
          </ErrorNotice>
          <button
            type="button"
            onClick={onRetry}
            className={`${SMALL_SECONDARY_CLASSES} self-start`}
          >
            {t.failures.retry}
          </button>
        </div>
      ) : null}
      {load.kind === "ok" ? (
        <Page
          response={load.response}
          filters={filters}
          sort={sort}
          onRemove={onRemove}
          onSort={onSort}
          onPage={onPage}
        />
      ) : null}
    </section>
  );
}

function Page({
  response,
  filters,
  sort,
  onRemove,
  onSort,
  onPage,
}: {
  response: IdentifiedCreatorSearchResponse;
  filters: Filters;
  sort: CreatorSearchSort;
  onRemove: (criterion: Criterion) => void;
  onSort: (sort: CreatorSearchSort) => void;
  onPage: (page: number) => void;
}) {
  const views = response.rows.map(rowViewOf);
  const widening = wideningOf(filters);
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col">
          <h2 className={BLOCK_TITLE} data-result-count={response.total}>
            {t.results.count(response.total)}
            <span className="ml-2 font-regular text-text-secondary">
              {t.results.sortedBy(t.sorts[sort] ?? sort)}
            </span>
          </h2>
          <p className={HELP_CLASSES}>{t.results.exactNote}</p>
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold text-text-primary">
          {t.sortLabel}
          <select
            value={sort}
            onChange={(event) => onSort(sortOf(event.target.value))}
            className={SELECT_CLASSES}
          >
            {sortOptions().map((option) => (
              <option key={option.code} value={option.code}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {views.length === 0 ? (
        <div className="flex flex-col gap-2" data-empty-results>
          <p className="font-semibold text-text-primary">{t.empty.title}</p>
          {widening.length === 0 ? (
            <p className={HELP_CLASSES}>{t.empty.none}</p>
          ) : (
            <>
              <p className={HELP_CLASSES}>{t.empty.lead}</p>
              <ul className="flex flex-wrap gap-2">
                {widening.map((item) => (
                  <li key={item.facet}>
                    <button
                      type="button"
                      onClick={() =>
                        onRemove({
                          facet: item.facet,
                          value: null,
                          id: item.facet,
                          text: item.label,
                        })
                      }
                      aria-label={t.criteria.remove(item.label)}
                      className={SMALL_SECONDARY_CLASSES}
                    >
                      {t.empty.removeFacet(item.label)}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      ) : (
        <DenseTableRegion label={t.results.tableLabel}>
          <table className={TABLE_CLASSES}>
            <thead>
              <tr>
                <th scope="col" className={TH_CLASSES}>
                  {t.columns.creator}
                </th>
                <th scope="col" className={TH_CLASSES}>
                  {t.columns.audience}
                </th>
                <th scope="col" className={TH_CLASSES}>
                  {t.columns.badges}
                </th>
                <th scope="col" className={TH_CLASSES}>
                  {t.columns.state}
                </th>
                <th scope="col" className={TH_CLASSES}>
                  {t.columns.owner}
                </th>
              </tr>
            </thead>
            {views.map((view) => (
              <CreatorRows key={view.key} view={view} />
            ))}
          </table>
        </DenseTableRegion>
      )}
      {response.capReached ? (
        <p role="status" className="text-sm text-feedback-warning-text">
          {t.results.capReached}
        </p>
      ) : null}
      <nav
        aria-label={t.results.pages}
        className="flex flex-wrap items-center gap-3"
      >
        <button
          type="button"
          disabled={response.page <= 1}
          onClick={() => onPage(response.page - 1)}
          className={SMALL_SECONDARY_CLASSES}
        >
          {t.results.previous}
        </button>
        <span className="text-sm text-text-secondary">
          {t.results.page(response.page)}
        </span>
        <button
          type="button"
          disabled={response.nextPage === null}
          onClick={() =>
            response.nextPage === null ? undefined : onPage(response.nextPage)
          }
          className={SMALL_SECONDARY_CLASSES}
        >
          {t.results.next}
        </button>
      </nav>
      <p className={HELP_CLASSES}>{t.results.noSelection}</p>
    </>
  );
}
