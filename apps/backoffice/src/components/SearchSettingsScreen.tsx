"use client";

// The settings of the creator search, admin only (docs/mvp/10 RG2, RG57; 05 CA63; 03 PD1 to PD7; 17b §3.11;
// jalons/l3g/modele.md §6, §7, §8; l3g-fiche invariants 9, 10, 12, 13; L3G-13). The ten keys are read as the base
// holds them, with the counters of the last snapshot and the alerts of the critical mass; the switch of the opening,
// the thresholds of the critical mass and k are REQUESTED here with a typed reason, then confirmed on the distinct
// screen of the dual control by ANOTHER administrator (D84, D38 Q2): without a peer the API answers 409
// `no_peer_admin` and nothing is requested. The opening is never decided by a counter or an alert (CA60). Who
// changed a key and when are in the register, not in the reader (EC-L3G-08b-1): the screen says so. It only
// draws: the rules are the database's and apps/api's.
import type { Alert } from "@influx/contracts/backoffice-actions";
import type { SearchSettingsResponse } from "@influx/contracts/search-settings";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState, type FormEvent } from "react";
import { messages } from "@/messages/fr";
import { alertLink, alertText } from "./alert-words";
import { ActionFeedback } from "./ActionFeedback";
import {
  HELP_CLASSES,
  LEAD_CLASSES,
  TITLE_CLASSES,
  WARNING_CLASSES,
} from "./auth-classes";
import {
  readAlerts,
  readSearchSettings,
  requestDualControl,
} from "./backoffice-api";
import {
  DD_CLASSES,
  DL_CLASSES,
  DT_CLASSES,
  FIELD_CLASSES,
  LINK_CLASSES,
  ROW_GROUP_CLASSES,
  SECTION_CLASSES,
  SECTION_TITLE,
  SELECT_CLASSES,
  SMALL_LABEL_CLASSES,
  SMALL_PRIMARY_CLASSES,
  TABLE_CLASSES,
  TD_CLASSES,
  TH_CLASSES,
  BLOCK_TITLE,
} from "./bo-classes";
import { DenseTableRegion } from "./DenseTableRegion";
import { ErrorNotice } from "./ErrorNotice";
import {
  anonymityRequest,
  countersViewOf,
  openingRequest,
  READ_ONLY_KEYS,
  REASONS,
  requestRefusal,
  SEARCH_SETTINGS_HREF,
  settingOf,
  settingWords,
  thresholdsRequest,
  type CountRow,
  type SearchSettingReason,
  type SettingField,
  type SettingProblem,
  type SettingRequest,
} from "./search-settings-view";
import { useAction } from "./use-action";
import Link from "next/link";

const t = messages.searchSettings;

type Settings = SearchSettingsResponse["settings"];

/** The reason of a request and the request itself: one gesture, its refusal, then the dual control screen. */
function useRequest() {
  const router = useRouter();
  const action = useAction();
  const [problem, setProblem] = useState<SettingProblem | null>(null);
  function send(request: SettingRequest) {
    if (!request.ok) {
      setProblem(request.problem);
      return;
    }
    setProblem(null);
    void action.run(
      () => requestDualControl(request.body),
      (view) => router.push(`/double-validation/${view.id}`),
      requestRefusal,
    );
  }
  return { action, problem, send };
}

function ReasonSelect({
  id,
  value,
  problem,
  onChange,
}: {
  id: string;
  value: SearchSettingReason | null;
  problem: SettingProblem | null;
  onChange: (value: SearchSettingReason | null) => void;
}) {
  const mine = problem?.field === "reason" ? problem : null;
  return (
    <div className={FIELD_CLASSES}>
      <label htmlFor={id} className={SMALL_LABEL_CLASSES}>
        {t.reasonLabel}
      </label>
      <select
        id={id}
        value={value ?? ""}
        aria-invalid={mine !== null || undefined}
        aria-describedby={mine === null ? undefined : `${id}-problem`}
        onChange={(event) =>
          onChange(REASONS.find((code) => code === event.target.value) ?? null)
        }
        className={SELECT_CLASSES}
      >
        <option value="">{t.reasonPlaceholder}</option>
        {REASONS.map((code) => (
          <option key={code} value={code}>
            {t.reasons[code]}
          </option>
        ))}
      </select>
      {mine === null ? null : (
        <ErrorNotice id={`${id}-problem`} announce={false}>
          {mine.text}
        </ErrorNotice>
      )}
    </div>
  );
}

function NumberField({
  id,
  label,
  help,
  value,
  field,
  problem,
  onChange,
}: {
  id: string;
  label: string;
  help?: string;
  value: string;
  field: SettingField;
  problem: SettingProblem | null;
  onChange: (value: string) => void;
}) {
  const mine = problem?.field === field ? problem : null;
  const describedBy = [
    help === undefined ? null : `${id}-help`,
    mine === null ? null : `${id}-problem`,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={FIELD_CLASSES}>
      <label htmlFor={id} className={SMALL_LABEL_CLASSES}>
        {label}
      </label>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        value={value}
        aria-invalid={mine !== null || undefined}
        aria-describedby={describedBy === "" ? undefined : describedBy}
        onChange={(event) => onChange(event.target.value)}
        className={SELECT_CLASSES}
      />
      {help === undefined ? null : (
        <p id={`${id}-help`} className={HELP_CLASSES}>
          {help}
        </p>
      )}
      {mine === null ? null : (
        <ErrorNotice id={`${id}-problem`} announce={false}>
          {mine.text}
        </ErrorNotice>
      )}
    </div>
  );
}

function OpeningSection({ settings }: { settings: Settings }) {
  const ids = { title: useId(), reason: useId() };
  const { action, problem, send } = useRequest();
  const [reason, setReason] = useState<SearchSettingReason | null>(null);
  const isOpen = settingOf(settings, "is_open_to_advertisers");
  if (isOpen === null) {
    return null;
  }
  return (
    <form
      noValidate
      aria-labelledby={ids.title}
      className={SECTION_CLASSES}
      onSubmit={(event: FormEvent) => {
        event.preventDefault();
        if (!action.busy) {
          send(openingRequest(isOpen, reason));
        }
      }}
    >
      <h2 id={ids.title} className={SECTION_TITLE}>
        {t.opening.title}
      </h2>
      <p
        data-search-opening={isOpen ? "open" : "closed"}
        className="font-semibold"
      >
        {isOpen ? t.opening.open : t.opening.closed}
      </p>
      <p className={HELP_CLASSES}>{t.opening.help}</p>
      <p className={HELP_CLASSES}>{t.historyNote}</p>
      <ReasonSelect
        id={ids.reason}
        value={reason}
        problem={problem}
        onChange={setReason}
      />
      <ActionFeedback action={action} />
      <button
        type="submit"
        aria-disabled={action.busy || undefined}
        className={`${SMALL_PRIMARY_CLASSES} self-start`}
      >
        {isOpen ? t.opening.askClose : t.opening.askOpen}
      </button>
    </form>
  );
}

function CountTable({
  title,
  firstColumn,
  rows,
}: {
  title: string;
  firstColumn: string;
  rows: readonly CountRow[];
}) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className={BLOCK_TITLE}>{title}</h3>
      {rows.length === 0 ? (
        <p className={HELP_CLASSES}>{t.mass.empty}</p>
      ) : (
        <DenseTableRegion label={title}>
          <table className={TABLE_CLASSES}>
            <caption className="sr-only">{title}</caption>
            <thead>
              <tr>
                <th scope="col" className={TH_CLASSES}>
                  {firstColumn}
                </th>
                <th scope="col" className={TH_CLASSES}>
                  {t.mass.columns.published}
                </th>
                <th scope="col" className={TH_CLASSES}>
                  {t.mass.columns.searchable}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key}>
                  <th
                    scope="row"
                    className={`${TD_CLASSES} text-left font-semibold`}
                  >
                    {row.label}
                  </th>
                  <td className={`${TD_CLASSES} tabular-nums`}>
                    {row.published}
                  </td>
                  <td className={`${TD_CLASSES} tabular-nums`}>
                    {row.searchable}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DenseTableRegion>
      )}
    </div>
  );
}

function MassSection({
  settings,
  counters,
}: {
  settings: Settings;
  counters: SearchSettingsResponse["counters"];
}) {
  const ids = {
    title: useId(),
    published: useId(),
    topic: useId(),
    reason: useId(),
  };
  const { action, problem, send } = useRequest();
  const current = settingOf(settings, "critical_mass_thresholds");
  const [published, setPublished] = useState(
    current === null ? "" : String(current.publishedProfiles),
  );
  const [perTopic, setPerTopic] = useState(
    current === null ? "" : String(current.perTopic),
  );
  const [reason, setReason] = useState<SearchSettingReason | null>(null);
  const view = counters === null ? null : countersViewOf(counters);
  return (
    <section aria-labelledby={ids.title} className={SECTION_CLASSES}>
      <h2 id={ids.title} className={SECTION_TITLE}>
        {t.mass.title}
      </h2>
      {view === null ? (
        <p className={HELP_CLASSES}>{t.mass.noSnapshot}</p>
      ) : (
        <>
          <p className="text-sm text-text-secondary">{view.snapshot}</p>
          <p data-supply-global className="font-semibold">
            {view.global}
          </p>
          <CountTable
            title={t.mass.topicsTitle}
            firstColumn={t.mass.columns.topic}
            rows={view.topics}
          />
          <CountTable
            title={t.mass.countriesTitle}
            firstColumn={t.mass.columns.country}
            rows={view.countries}
          />
          <CountTable
            title={t.mass.curveTitle}
            firstColumn={t.mass.columns.day}
            rows={view.curve}
          />
        </>
      )}
      <form
        noValidate
        aria-label={t.mass.thresholdsTitle}
        className="flex flex-col gap-3"
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          if (!action.busy) {
            send(
              thresholdsRequest(
                { publishedProfiles: published, perTopic },
                current,
                reason,
              ),
            );
          }
        }}
      >
        <h3 className={BLOCK_TITLE}>{t.mass.thresholdsTitle}</h3>
        <p className={HELP_CLASSES}>{t.mass.thresholdsHelp}</p>
        <div className={ROW_GROUP_CLASSES}>
          <NumberField
            id={ids.published}
            label={t.mass.publishedProfiles}
            value={published}
            field="publishedProfiles"
            problem={problem}
            onChange={setPublished}
          />
          <NumberField
            id={ids.topic}
            label={t.mass.perTopic}
            value={perTopic}
            field="perTopic"
            problem={problem}
            onChange={setPerTopic}
          />
          <ReasonSelect
            id={ids.reason}
            value={reason}
            problem={problem}
            onChange={setReason}
          />
        </div>
        <ActionFeedback action={action} />
        <button
          type="submit"
          aria-disabled={action.busy || undefined}
          className={`${SMALL_PRIMARY_CLASSES} self-start`}
        >
          {t.submit}
        </button>
      </form>
    </section>
  );
}

function AnonymitySection({ settings }: { settings: Settings }) {
  const ids = { title: useId(), k: useId(), reason: useId() };
  const { action, problem, send } = useRequest();
  const current = settingOf(settings, "k_anonymity_threshold");
  const [k, setK] = useState(current === null ? "" : String(current));
  const [reason, setReason] = useState<SearchSettingReason | null>(null);
  return (
    <form
      noValidate
      aria-labelledby={ids.title}
      className={SECTION_CLASSES}
      onSubmit={(event: FormEvent) => {
        event.preventDefault();
        if (!action.busy) {
          send(anonymityRequest(k, current, reason));
        }
      }}
    >
      <h2 id={ids.title} className={SECTION_TITLE}>
        {t.anonymity.title}
      </h2>
      <div className={ROW_GROUP_CLASSES}>
        <NumberField
          id={ids.k}
          label={t.anonymity.label}
          help={t.anonymity.help}
          value={k}
          field="k"
          problem={problem}
          onChange={setK}
        />
        <ReasonSelect
          id={ids.reason}
          value={reason}
          problem={problem}
          onChange={setReason}
        />
      </div>
      <ActionFeedback action={action} />
      <button
        type="submit"
        aria-disabled={action.busy || undefined}
        className={`${SMALL_PRIMARY_CLASSES} self-start`}
      >
        {t.submit}
      </button>
    </form>
  );
}

function OthersSection({ settings }: { settings: Settings }) {
  return (
    <section aria-labelledby="search-others" className={SECTION_CLASSES}>
      <h2 id="search-others" className={SECTION_TITLE}>
        {t.others.title}
      </h2>
      <p className={HELP_CLASSES}>{t.others.help}</p>
      <dl className={DL_CLASSES}>
        {READ_ONLY_KEYS.map((key) => {
          const found = settings.find((setting) => setting.key === key);
          return found === undefined ? null : (
            <div key={key} className="contents">
              <dt className={DT_CLASSES}>{t.keys[key] ?? key}</dt>
              <dd className={DD_CLASSES}>{settingWords(found)}</dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}

function AlertsSection({ alerts }: { alerts: readonly Alert[] | "failed" }) {
  return (
    <section aria-labelledby="search-alerts" className={SECTION_CLASSES}>
      <h2 id="search-alerts" className={SECTION_TITLE}>
        {t.alerts.title}
      </h2>
      {alerts === "failed" ? (
        <ErrorNotice>{t.alerts.error}</ErrorNotice>
      ) : alerts.length === 0 ? (
        <p className={HELP_CLASSES}>{t.alerts.none}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {alerts.map((alert) => {
            const link = alertLink(alert);
            return (
              <li
                key={`${alert.code}-${alert.cause}`}
                className={WARNING_CLASSES}
              >
                {alertText(alert)}
                {link === null || link.href === SEARCH_SETTINGS_HREF ? null : (
                  <>
                    {" "}
                    <Link href={link.href} className={LINK_CLASSES}>
                      {link.label}
                    </Link>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** The alerts of the search among those the API derives: AL22 and AL65 (the others have their own screens). */
function searchAlertsOf(alerts: readonly Alert[]): Alert[] {
  return alerts.filter(
    (alert) => alert.code === "AL22" || alert.code === "AL65",
  );
}

export function SearchSettingsScreen() {
  const router = useRouter();
  const [loaded, setLoaded] = useState<SearchSettingsResponse | null>(null);
  const [alerts, setAlerts] = useState<Alert[] | "failed" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void readSearchSettings().then((result) => {
      if (!active) {
        return;
      }
      if (result.kind === "ok") {
        setLoaded(result.data);
      } else if (result.kind === "unauthenticated") {
        router.replace("/");
      } else {
        setError(
          result.code === "forbidden" ? messages.failure.forbidden : t.error,
        );
      }
    });
    void readAlerts().then((result) => {
      if (!active) {
        return;
      }
      if (result.kind === "ok") {
        setAlerts(searchAlertsOf(result.data.alerts));
      } else if (result.kind !== "unauthenticated") {
        setAlerts("failed");
      }
    });
    return () => {
      active = false;
    };
  }, [router]);

  return (
    <>
      <h1 className={TITLE_CLASSES}>{t.title}</h1>
      <p className={LEAD_CLASSES}>{t.lead}</p>
      <p className={HELP_CLASSES}>{t.historyNote}</p>
      {error !== null ? (
        <ErrorNotice>{error}</ErrorNotice>
      ) : loaded === null ? (
        <p role="status" className={HELP_CLASSES}>
          {t.loading}
        </p>
      ) : (
        <>
          {alerts === null ? null : <AlertsSection alerts={alerts} />}
          <OpeningSection settings={loaded.settings} />
          <MassSection settings={loaded.settings} counters={loaded.counters} />
          <AnonymitySection settings={loaded.settings} />
          <OthersSection settings={loaded.settings} />
        </>
      )}
    </>
  );
}
