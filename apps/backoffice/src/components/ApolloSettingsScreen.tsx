"use client";

// The Apollo settings, admin only (docs/mvp/05 RG81, RG83, RG84, CA63; 03 PD1 to PD7; 17b §3.11).
// Each key is read with its last change; a change is REQUESTED here with a typed reason, then
// confirmed on the distinct screen of the dual control (PD2), where the value is shown again. An
// empty list of countries is an abstention, never a send by default (RG84): the screen says so.
import {
  PROSPECTING_LEGAL_BASES,
  PROSPECTING_SCOPES,
  PROSPECTING_SETTING_REASONS,
  type ApolloSetting,
  type ApolloSettingsResponse,
} from "@influx/contracts/backoffice-actions";
import type { CountryCode } from "@influx/contracts/countries";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState, type FormEvent } from "react";
import { messages } from "@/messages/fr";
import {
  ERROR_CLASSES,
  HELP_CLASSES,
  LEAD_CLASSES,
  TITLE_CLASSES,
} from "./auth-classes";
import { ActionFeedback } from "./ActionFeedback";
import { readApolloSettings, requestDualControl } from "./backoffice-api";
import {
  FIELD_CLASSES,
  ROW_GROUP_CLASSES,
  SECTION_CLASSES,
  SECTION_TITLE_CLASSES,
  SELECT_CLASSES,
  SMALL_LABEL_CLASSES,
  SMALL_PRIMARY_CLASSES,
  TEXTAREA_CLASSES,
} from "./bo-classes";
import { useAction } from "./use-action";
import {
  apolloSettingWords,
  formatByCountry,
  formatDateTime,
  parseByCountry,
  parseCountryList,
} from "./view-model";

const t = messages.apollo;
type Reason = (typeof PROSPECTING_SETTING_REASONS)[number];
type Row = ApolloSettingsResponse["settings"][number];

function ReasonSelect({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className={FIELD_CLASSES}>
      <label htmlFor={id} className={SMALL_LABEL_CLASSES}>
        {messages.common.reason}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={SELECT_CLASSES}
      >
        <option value="">{messages.common.reasonPlaceholder}</option>
        {PROSPECTING_SETTING_REASONS.map((code) => (
          <option key={code} value={code}>
            {t.reasons[code]}
          </option>
        ))}
      </select>
    </div>
  );
}

/** One key: its value in force, the editor, the reason, the request. */
function SettingForm({ row }: { row: Row }) {
  const router = useRouter();
  const ids = {
    value: useId(),
    extra: useId(),
    reason: useId(),
    title: useId(),
  };
  const action = useAction();
  const { setting } = row;
  const [scope, setScope] = useState<string>(
    setting.key === "apollo_scope" ? setting.value : "",
  );
  const [countries, setCountries] = useState(
    setting.key === "apollo_prospecting_countries"
      ? setting.value.join(" ")
      : "",
  );
  const [basis, setBasis] = useState<string>(
    setting.key === "apollo_legal_basis" ? setting.value.default : "",
  );
  const [byCountry, setByCountry] = useState(
    setting.key === "apollo_legal_basis"
      ? formatByCountry(setting.value.byCountry)
      : "",
  );
  const [reason, setReason] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  /** The new value as the contract types it, or a message of the form. */
  function newSetting(): ApolloSetting | string {
    switch (setting.key) {
      case "apollo_scope":
        return {
          key: "apollo_scope",
          value: scope as (typeof PROSPECTING_SCOPES)[number],
        };
      case "apollo_prospecting_countries": {
        const parsed = parseCountryList(countries);
        return parsed.unknown.length > 0
          ? t.countriesInvalid(parsed.unknown.join(", "))
          : {
              key: "apollo_prospecting_countries",
              value: parsed.codes as CountryCode[],
            };
      }
      case "apollo_legal_basis": {
        const entries = parseByCountry(byCountry);
        return entries === null
          ? t.byCountryInvalid
          : {
              key: "apollo_legal_basis",
              value: {
                default: basis as (typeof PROSPECTING_LEGAL_BASES)[number],
                byCountry: entries.map((entry) => ({
                  countryCode: entry.countryCode as CountryCode,
                  basis: entry.basis,
                })),
              },
            };
      }
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = newSetting();
    if (typeof value === "string") {
      setFormError(value);
      return;
    }
    if (reason === "") {
      setFormError(messages.common.reasonPlaceholder);
      return;
    }
    setFormError(null);
    void action.run(
      () =>
        requestDualControl({
          code: "leads.change_apollo_setting",
          setting: value,
          reasonCode: reason as Reason,
        }),
      (view) => router.push(`/double-validation/${view.id}`),
    );
  }

  const title =
    setting.key === "apollo_scope"
      ? t.scope
      : setting.key === "apollo_prospecting_countries"
        ? t.countries
        : t.legalBasis;

  return (
    <form
      noValidate
      onSubmit={submit}
      aria-labelledby={ids.title}
      className={SECTION_CLASSES}
    >
      <h2 id={ids.title} className={SECTION_TITLE_CLASSES}>
        {title}
      </h2>
      <p>{apolloSettingWords(setting)}</p>
      <p className={HELP_CLASSES}>{t.updated(formatDateTime(row.updatedAt))}</p>
      <div className={ROW_GROUP_CLASSES}>
        {setting.key === "apollo_scope" ? (
          <div className={FIELD_CLASSES}>
            <label htmlFor={ids.value} className={SMALL_LABEL_CLASSES}>
              {t.scope}
            </label>
            <select
              id={ids.value}
              value={scope}
              onChange={(event) => setScope(event.target.value)}
              className={SELECT_CLASSES}
            >
              {PROSPECTING_SCOPES.map((code) => (
                <option key={code} value={code}>
                  {t.scopes[code]}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        {setting.key === "apollo_legal_basis" ? (
          <div className={FIELD_CLASSES}>
            <label htmlFor={ids.value} className={SMALL_LABEL_CLASSES}>
              {t.legalBasisDefault}
            </label>
            <select
              id={ids.value}
              value={basis}
              onChange={(event) => setBasis(event.target.value)}
              className={SELECT_CLASSES}
            >
              {PROSPECTING_LEGAL_BASES.map((code) => (
                <option key={code} value={code}>
                  {t.legalBases[code]}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <ReasonSelect id={ids.reason} value={reason} onChange={setReason} />
      </div>
      {setting.key === "apollo_prospecting_countries" ? (
        <div className={FIELD_CLASSES}>
          <label htmlFor={ids.value} className={SMALL_LABEL_CLASSES}>
            {t.countries}
          </label>
          <textarea
            id={ids.value}
            spellCheck={false}
            value={countries}
            aria-describedby={`${ids.value}-help`}
            onChange={(event) => setCountries(event.target.value)}
            className={TEXTAREA_CLASSES}
          />
          <p id={`${ids.value}-help`} className={HELP_CLASSES}>
            {t.countriesHelp}
          </p>
        </div>
      ) : null}
      {setting.key === "apollo_legal_basis" ? (
        <div className={FIELD_CLASSES}>
          <label htmlFor={ids.extra} className={SMALL_LABEL_CLASSES}>
            {t.byCountry}
          </label>
          <textarea
            id={ids.extra}
            spellCheck={false}
            value={byCountry}
            aria-describedby={`${ids.extra}-help`}
            onChange={(event) => setByCountry(event.target.value)}
            className={TEXTAREA_CLASSES}
          />
          <p id={`${ids.extra}-help`} className={HELP_CLASSES}>
            {t.byCountryHelp}
          </p>
        </div>
      ) : null}
      {formError === null ? null : (
        <p role="alert" className={ERROR_CLASSES}>
          {formError}
        </p>
      )}
      <ActionFeedback action={action} />
      <button
        type="submit"
        aria-disabled={action.busy || undefined}
        className={`${SMALL_PRIMARY_CLASSES} self-start`}
      >
        {t.change}
      </button>
    </form>
  );
}

export function ApolloSettingsScreen() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void readApolloSettings().then((result) => {
      if (!active) {
        return;
      }
      if (result.kind === "ok") {
        setRows(result.data.settings);
      } else if (result.kind === "unauthenticated") {
        router.replace("/");
      } else {
        setError(
          result.code === "forbidden" ? messages.failure.forbidden : t.error,
        );
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
      {error !== null ? (
        <p role="alert" className={ERROR_CLASSES}>
          {error}
        </p>
      ) : rows === null ? (
        <p role="status" className={HELP_CLASSES}>
          {messages.common.loading}
        </p>
      ) : (
        rows.map((row) => <SettingForm key={row.setting.key} row={row} />)
      )}
    </>
  );
}
