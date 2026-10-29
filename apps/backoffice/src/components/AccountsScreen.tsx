"use client";

// The registered members and their synchronisation (docs/mvp/05 RG97 to RG100, RG106, CA58 to
// CA61; 15 RG33, RG34, RG121; 17b §2.2, §3.11). A dense table; the address bar carries the filters,
// the period (days) and the page, codes only, never personal data. The search term stays in the
// screen's memory and travels in the body of POST /v1/bo/accounts/search (J8S-7): never in the
// address bar, the history or a log. "À traiter" and "Cas normaux" are two views, never a sum
// (RG100). A row without a failure has no replay box — absence plus a phrase, never a greyed
// control (RG103). No export exists, for any role (RG106). ‹j›/‹k› move between rows.
import {
  SYNC_DESTINATIONS,
  type AccountRow,
  type AccountsResponse,
  type AccountsSearchBody,
} from "@influx/contracts/backoffice-accounts";
import { SIGNUP_DOORS, UI_LOCALES } from "@influx/contracts/auth";
import { DECLARED_STATUSES } from "@influx/contracts/signup";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { messages } from "@/messages/fr";
import {
  HELP_CLASSES,
  inputClasses,
  LEAD_CLASSES,
  TITLE_CLASSES,
} from "./auth-classes";
import { searchAccounts } from "./backoffice-api";
import {
  FIELD_CLASSES,
  LINK_CLASSES,
  ROW_GROUP_CLASSES,
  rowClasses,
  SECTION_CLASSES,
  SELECT_CLASSES,
  SMALL_LABEL_CLASSES,
  SMALL_PRIMARY_CLASSES,
  SMALL_SECONDARY_CLASSES,
  TABLE_CLASSES,
  DENSE_TABLE_WRAP_CLASSES,
  TD_CLASSES,
  TH_CLASSES,
} from "./bo-classes";
import { ReplayPanel } from "./ReplayPanel";
import { ServicesHint } from "./ServicesLink";
import {
  accountSearchOf,
  countryName,
  countryOptions,
  failedDestinations,
  formatDate,
  periodOf,
  replayPairs,
  REPLAY_CAP,
  type AccountSearch,
} from "./view-model";
import { ErrorNotice } from "./ErrorNotice";

/**
 * The filters the address bar may carry (05 RG97), each value of plain characters only; the period
 * as two days "YYYY-MM-DD". Never a search term (J8S-7).
 */
const FILTER_KEYS = [
  "role",
  "country",
  "language",
  "declaredStatus",
  "syncState",
  "syncDestination",
  "consent",
  "from",
  "to",
  "cursor",
] as const;
type FilterKey = (typeof FILTER_KEYS)[number];
const PLAIN = /^[A-Za-z0-9_-]{1,200}$/;

type Load =
  | { kind: "loading" }
  | { kind: "ok"; data: AccountsResponse }
  | { kind: "error"; message: string };

function SyncCell({
  row,
  destination,
}: {
  row: AccountRow;
  destination: "brevo" | "apollo";
}) {
  const status = row.sync[destination];
  return (
    <>
      <span className="block font-semibold">
        {messages.syncState[status.state]}
      </span>
      <span className="block text-text-secondary">
        {status.setting === null
          ? messages.syncCause[status.cause]
          : messages.syncCauseWithSetting(
              messages.syncCause[status.cause],
              messages.syncSetting[status.setting],
            )}
      </span>
    </>
  );
}

export function AccountsScreen() {
  const router = useRouter();
  const search = useSearchParams();
  const ids = {
    search: useId(),
    searchHelp: useId(),
    searchError: useId(),
    periodHelp: useId(),
  };
  const query = useMemo(() => {
    const found: Partial<Record<FilterKey, string>> = {};
    for (const key of FILTER_KEYS) {
      const value = search.get(key);
      if (value !== null && PLAIN.test(value)) {
        found[key] = value;
      }
    }
    return found;
  }, [search]);
  // The search submitted, in memory only (J8S-7): never in the address bar.
  const [searched, setSearched] = useState<AccountSearch | null>(null);
  // Each answer is kept with the load it belongs to: a new address, a new search or a reload shows
  // "loading" and an empty selection without a state reset inside the effect.
  const [reload, setReload] = useState(0);
  const loadKey = `${JSON.stringify(query)}#${JSON.stringify(searched)}#${reload}`;
  const [answer, setAnswer] = useState<{ key: string; load: Load } | null>(
    null,
  );
  const [selection, setSelection] = useState<{
    key: string;
    ids: ReadonlySet<string>;
  } | null>(null);
  // 05 RG97: a period that ends before it starts is said, never sent.
  const period = useMemo(() => periodOf(query.from, query.to), [query]);
  const load: Load =
    period === "invalid"
      ? { kind: "error", message: messages.accounts.periodInvalid }
      : answer?.key === loadKey
        ? answer.load
        : { kind: "loading" };
  const selected: ReadonlySet<string> =
    selection?.key === loadKey ? selection.ids : new Set();
  function setSelected(ids: ReadonlySet<string>) {
    setSelection({ key: loadKey, ids });
  }
  const [replaying, setReplaying] = useState(false);
  const [term, setTerm] = useState("");
  const [termError, setTermError] = useState(false);
  const links = useRef<(HTMLAnchorElement | null)[]>([]);
  const countries = useMemo(() => countryOptions(), []);

  useEffect(() => {
    if (period === "invalid") {
      return undefined;
    }
    let active = true;
    // codes of the address bar, checked again by apps/api's schema (a wrong one is a 400); the
    // days of the period replaced by their instants
    const body = {
      ...query,
      ...period,
      ...searched,
    } as AccountsSearchBody;
    void searchAccounts(body).then((result) => {
      if (!active) {
        return;
      }
      if (result.kind === "ok") {
        setAnswer({ key: loadKey, load: { kind: "ok", data: result.data } });
      } else if (result.kind === "unauthenticated") {
        router.replace("/");
      } else {
        setAnswer({
          key: loadKey,
          load: {
            kind: "error",
            message:
              result.code === "rate_limited"
                ? messages.failure.rateLimited
                : messages.accounts.error,
          },
        });
      }
    });
    return () => {
      active = false;
    };
  }, [query, period, searched, loadKey, router]);

  /** A new address: the filters changed, so the page restarts at the first one. */
  function go(changes: Partial<Record<FilterKey, string | null>>) {
    const next = new URLSearchParams();
    const merged: Partial<Record<FilterKey, string | null>> = {
      ...query,
      cursor: null,
      ...changes,
    };
    // 05 RG97 contract: a destination only with a state
    if (merged.syncState === null || merged.syncState === undefined) {
      merged.syncDestination = null;
    }
    for (const key of FILTER_KEYS) {
      const value = merged[key];
      if (value !== null && value !== undefined && value !== "") {
        next.set(key, value);
      }
    }
    const text = next.toString();
    router.replace(text === "" ? "/inscrits" : `/inscrits?${text}`);
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = accountSearchOf(term);
    if (parsed === "invalid") {
      setTermError(true);
      return;
    }
    setTermError(false);
    setSearched(parsed);
    go({});
  }

  function onTableKey(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "j" && event.key !== "k") {
      return;
    }
    const anchors = links.current.filter(
      (anchor): anchor is HTMLAnchorElement => anchor !== null,
    );
    const at = anchors.findIndex((anchor) => anchor === document.activeElement);
    const target =
      event.key === "j"
        ? Math.min(anchors.length - 1, at + 1)
        : Math.max(0, at === -1 ? 0 : at - 1);
    anchors[target]?.focus();
    event.preventDefault();
  }

  const rows = load.kind === "ok" ? load.data.items : [];
  const pairs = replayPairs(rows, selected);
  const t = messages.accounts;
  const view = query.syncState ?? "";

  function filterSelect(
    key: FilterKey,
    label: string,
    options: readonly { value: string; label: string }[],
  ) {
    const id = `filter-${key}`;
    return (
      <div className={FIELD_CLASSES}>
        <label htmlFor={id} className={SMALL_LABEL_CLASSES}>
          {label}
        </label>
        <select
          id={id}
          value={query[key] ?? ""}
          onChange={(event) => go({ [key]: event.target.value || null })}
          className={SELECT_CLASSES}
        >
          <option value="">{t.all}</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <>
      <h1 className={TITLE_CLASSES}>{t.title}</h1>
      <p className={LEAD_CLASSES}>{t.lead}</p>
      <p className={HELP_CLASSES}>{t.noExport}</p>
      {view === "failed" ? <ServicesHint text={t.servicesHint} /> : null}
      <section aria-label={t.filters} className={SECTION_CLASSES}>
        <div className={ROW_GROUP_CLASSES}>
          {filterSelect("syncState", t.view, [
            { value: "failed", label: t.viewFailed },
            { value: "skipped", label: t.viewNormal },
          ])}
          {view === ""
            ? null
            : filterSelect(
                "syncDestination",
                t.destination,
                SYNC_DESTINATIONS.map((value) => ({
                  value,
                  label: messages.destinations[value],
                })),
              )}
          {filterSelect(
            "role",
            t.role,
            SIGNUP_DOORS.map((value) => ({
              value,
              label: messages.roles[value],
            })),
          )}
          {filterSelect(
            "country",
            t.country,
            countries.map((country) => ({
              value: country.code,
              label: country.name,
            })),
          )}
          {filterSelect(
            "language",
            t.language,
            UI_LOCALES.map((value) => ({
              value,
              label: messages.languages[value],
            })),
          )}
          {filterSelect(
            "declaredStatus",
            t.declaredStatus,
            DECLARED_STATUSES.map((value) => ({
              value,
              label: messages.declaredStatus[value],
            })),
          )}
          {filterSelect("consent", t.consent, [
            { value: "granted", label: t.consentGranted },
            { value: "withdrawn", label: t.consentWithdrawn },
          ])}
        </div>
        <p className={HELP_CLASSES}>{t.viewHelp}</p>
        <fieldset
          aria-describedby={ids.periodHelp}
          className={ROW_GROUP_CLASSES}
        >
          <legend className={SMALL_LABEL_CLASSES}>{t.period}</legend>
          {(["from", "to"] as const).map((key) => (
            <div key={key} className={FIELD_CLASSES}>
              <label htmlFor={`period-${key}`} className={SMALL_LABEL_CLASSES}>
                {key === "from" ? t.periodFrom : t.periodTo}
              </label>
              <input
                id={`period-${key}`}
                type="date"
                value={query[key] ?? ""}
                onChange={(event) => go({ [key]: event.target.value || null })}
                className={inputClasses(false)}
              />
            </div>
          ))}
        </fieldset>
        <p id={ids.periodHelp} className={HELP_CLASSES}>
          {t.periodHelp}
        </p>
        <form noValidate onSubmit={submitSearch} className={ROW_GROUP_CLASSES}>
          <div className={FIELD_CLASSES}>
            <label htmlFor={ids.search} className={SMALL_LABEL_CLASSES}>
              {t.search}
            </label>
            <input
              id={ids.search}
              type="search"
              spellCheck={false}
              value={term}
              aria-invalid={termError || undefined}
              aria-describedby={
                termError
                  ? `${ids.searchHelp} ${ids.searchError}`
                  : ids.searchHelp
              }
              onChange={(event) => setTerm(event.target.value)}
              className={inputClasses(termError)}
            />
          </div>
          <button type="submit" className={SMALL_PRIMARY_CLASSES}>
            {t.searchSubmit}
          </button>
          <button
            type="button"
            onClick={() => {
              setTerm("");
              setTermError(false);
              setSearched(null);
              router.replace("/inscrits");
            }}
            className={SMALL_SECONDARY_CLASSES}
          >
            {t.reset}
          </button>
        </form>
        <p id={ids.searchHelp} className={HELP_CLASSES}>
          {t.searchHelp}
        </p>
        {termError ? (
          <ErrorNotice id={ids.searchError}>{t.searchInvalid}</ErrorNotice>
        ) : null}
      </section>

      {replaying && pairs.length > 0 ? (
        <ReplayPanel
          pairs={pairs}
          onCancel={() => setReplaying(false)}
          onDone={() => {
            setReplaying(false);
            setReload(reload + 1);
          }}
        />
      ) : null}

      {load.kind === "loading" ? (
        <p role="status" className={HELP_CLASSES}>
          {messages.common.loading}
        </p>
      ) : load.kind === "error" ? (
        <div className="flex flex-col gap-3">
          <ErrorNotice>{load.message}</ErrorNotice>
          <button
            type="button"
            onClick={() => setReload(reload + 1)}
            className={SMALL_SECONDARY_CLASSES}
          >
            {messages.common.retry}
          </button>
        </div>
      ) : (
        <>
          {load.data.search === "none" ? null : (
            <p role="status" className={HELP_CLASSES}>
              {load.data.search === "partial"
                ? t.searchJournaled
                : t.searchExact}
            </p>
          )}
          <div className={ROW_GROUP_CLASSES}>
            <p className={HELP_CLASSES}>
              {messages.replay.selection(pairs.length, REPLAY_CAP)}
            </p>
            {pairs.length === 0 ? null : (
              <button
                type="button"
                onClick={() => setReplaying(true)}
                className={SMALL_PRIMARY_CLASSES}
              >
                {messages.replay.open(pairs.length)}
              </button>
            )}
          </div>
          {rows.length === 0 ? (
            <p className={HELP_CLASSES}>{t.empty}</p>
          ) : (
            // the keys are listened on the table's container: a keyboard user moves with ‹j›/‹k›
            // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
            <div
              role="region"
              aria-label={t.title}
              // a scrollable region must be reachable by keyboard (axe scrollable-region-focusable)
              // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
              tabIndex={0}
              className={DENSE_TABLE_WRAP_CLASSES}
              onKeyDown={onTableKey}
            >
              <table className={TABLE_CLASSES}>
                <caption className="sr-only">{t.title}</caption>
                <thead>
                  <tr>
                    {(
                      [
                        "select",
                        "createdAt",
                        "role",
                        "country",
                        "language",
                        "status",
                        "consent",
                        "source",
                        "brevo",
                        "apollo",
                        "owner",
                        "open",
                      ] as const
                    ).map((column) => (
                      <th key={column} scope="col" className={TH_CLASSES}>
                        {t.columns[column]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => {
                    const failed = failedDestinations(row);
                    const isSelected = selected.has(row.id);
                    return (
                      <tr key={row.id} className={rowClasses(isSelected)}>
                        <td className={TD_CLASSES}>
                          {failed.length === 0 ? null : (
                            <input
                              type="checkbox"
                              checked={isSelected}
                              aria-label={t.selectRow(
                                formatDate(row.createdAt),
                              )}
                              onChange={() => {
                                const next = new Set(selected);
                                if (isSelected) {
                                  next.delete(row.id);
                                } else {
                                  next.add(row.id);
                                }
                                setSelected(next);
                              }}
                              className="size-(--size-checkbox)"
                            />
                          )}
                        </td>
                        <td className={`${TD_CLASSES} tabular-nums`}>
                          {formatDate(row.createdAt)}
                        </td>
                        <td className={TD_CLASSES}>
                          {messages.roles[row.role]}
                          {row.status === "active" ? null : (
                            <span className="block text-text-secondary">
                              {messages.accountStatus[row.status]}
                            </span>
                          )}
                        </td>
                        <td className={TD_CLASSES}>
                          {countryName(row.countryCode)}
                        </td>
                        <td className={TD_CLASSES}>
                          {messages.languages[row.preferredLanguage]}
                        </td>
                        <td className={TD_CLASSES}>
                          {messages.declaredStatus[row.declaredStatus]}
                        </td>
                        <td className={TD_CLASSES}>
                          {row.consent === null
                            ? messages.common.none
                            : row.consent.granted
                              ? t.consentGranted
                              : t.consentWithdrawn}
                        </td>
                        <td className={TD_CLASSES}>
                          {row.source.viaInvitation
                            ? t.sourceInvitation
                            : (row.source.utmSource ?? t.sourceDirect)}
                        </td>
                        <td className={TD_CLASSES}>
                          <SyncCell row={row} destination="brevo" />
                        </td>
                        <td className={TD_CLASSES}>
                          <SyncCell row={row} destination="apollo" />
                        </td>
                        <td className={TD_CLASSES}>
                          {row.owner?.displayName ?? t.unowned}
                        </td>
                        <td className={TD_CLASSES}>
                          <Link
                            ref={(anchor) => {
                              links.current[index] = anchor;
                            }}
                            href={`/inscrits/${row.id}`}
                            className={LINK_CLASSES}
                          >
                            {t.openRecord}
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className={HELP_CLASSES}>{messages.common.keys}</p>
          <div className={ROW_GROUP_CLASSES}>
            {query.cursor === undefined ? null : (
              <button
                type="button"
                onClick={() => go({})}
                className={SMALL_SECONDARY_CLASSES}
              >
                {messages.common.first}
              </button>
            )}
            {load.data.nextCursor === null ? null : (
              <button
                type="button"
                onClick={() => go({ ...query, cursor: load.data.nextCursor })}
                className={SMALL_SECONDARY_CLASSES}
              >
                {messages.common.next}
              </button>
            )}
          </div>
        </>
      )}
    </>
  );
}
