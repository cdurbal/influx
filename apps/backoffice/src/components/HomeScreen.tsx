"use client";

// Home of the backoffice v0 (docs/mvp/05 RG104, RG105, CA62; 15 §F; 17b §3.11, §3.14.e). The
// counters of the day and the alerts, each alert in words with its count and its start — never a
// colour alone (15 RG66). The "new browser" sign-ins (B-7, RG145) reach the admins only: apps/api
// returns an empty list to an agent.
import type { AccountCountersResponse } from "@influx/contracts/backoffice-accounts";
import type { AlertsResponse } from "@influx/contracts/backoffice-actions";
import Link from "next/link";
import { useEffect, useState } from "react";
import { messages } from "@/messages/fr";
import {
  ERROR_CLASSES,
  HELP_CLASSES,
  LEAD_CLASSES,
  TITLE_CLASSES,
  WARNING_CLASSES,
} from "./auth-classes";
import { readAlerts, readCounters } from "./backoffice-api";
import {
  LINK_CLASSES,
  SECTION_CLASSES,
  SECTION_TITLE_CLASSES,
  TABULAR_CLASSES,
} from "./bo-classes";
import {
  browserLabel,
  countryName,
  formatDateTime,
  formatDay,
  formatLongDate,
  formatTime,
  sharePercent,
} from "./view-model";

type Load<T> =
  { kind: "loading" } | { kind: "ok"; data: T } | { kind: "error" };

function Counters({ counters }: { counters: AccountCountersResponse }) {
  const t = messages.home;
  return (
    <ul className={`flex flex-col gap-1 text-sm ${TABULAR_CLASSES}`}>
      <li>
        {t.signups(
          counters.signups.total,
          counters.signups.advertiser,
          counters.signups.creator,
        )}
      </li>
      <li>
        {t.countries(
          counters.topCountries
            .map((row) =>
              t.countryCount(countryName(row.countryCode), row.count),
            )
            .join(" · "),
          counters.otherCountries,
        )}
      </li>
      <li>
        {t.share(
          t.brevoWithinHour,
          sharePercent(
            counters.brevoWithinHour.synced,
            counters.brevoWithinHour.eligible,
          ),
          counters.brevoWithinHour.synced,
          counters.brevoWithinHour.eligible,
        )}
      </li>
      <li>
        {t.share(
          t.apolloWithin24Hours,
          sharePercent(
            counters.apolloWithin24Hours.synced,
            counters.apolloWithin24Hours.eligible,
          ),
          counters.apolloWithin24Hours.synced,
          counters.apolloWithin24Hours.eligible,
        )}
      </li>
      <li>
        {t.failures(
          counters.unhandledFailures.brevo,
          counters.unhandledFailures.apollo,
        )}{" "}
        <Link href="/inscrits?syncState=failed" className={LINK_CLASSES}>
          {t.seeFailures}
        </Link>
      </li>
    </ul>
  );
}

function Alerts({ data }: { data: AlertsResponse }) {
  const t = messages.alert;
  if (data.alerts.length === 0 && data.newBrowserSignIns.length === 0) {
    return <p className={HELP_CLASSES}>{messages.home.noAlert}</p>;
  }
  return (
    <ul className="flex flex-col gap-2">
      {data.alerts.map((alert) => {
        const destination =
          alert.destination === null
            ? ""
            : messages.destinations[alert.destination];
        const words = t.cause[alert.cause];
        return (
          <li
            key={`${alert.code}-${alert.cause}-${alert.destination ?? ""}`}
            className={WARNING_CLASSES}
          >
            {t.line(
              alert.code,
              words === undefined
                ? alert.cause
                : words(destination, alert.count),
              alert.since === null ? null : formatDateTime(alert.since),
            )}
          </li>
        );
      })}
      {data.newBrowserSignIns.map((signIn) => (
        <li
          key={`${signIn.accountId}-${signIn.signedInAt}`}
          className={WARNING_CLASSES}
        >
          <strong className="block">{t.newBrowser.title}</strong>
          {t.newBrowser.body(
            signIn.firstName ?? t.newBrowser.unnamed,
            formatLongDate(signIn.signedInAt),
            formatTime(signIn.signedInAt),
            browserLabel(signIn.browser),
          )}
        </li>
      ))}
    </ul>
  );
}

export function HomeScreen() {
  const [counters, setCounters] = useState<Load<AccountCountersResponse>>({
    kind: "loading",
  });
  const [alerts, setAlerts] = useState<Load<AlertsResponse>>({
    kind: "loading",
  });

  useEffect(() => {
    let active = true;
    void readCounters().then((result) => {
      if (active) {
        setCounters(
          result.kind === "ok"
            ? { kind: "ok", data: result.data }
            : { kind: "error" },
        );
      }
    });
    void readAlerts().then((result) => {
      if (active) {
        setAlerts(
          result.kind === "ok"
            ? { kind: "ok", data: result.data }
            : { kind: "error" },
        );
      }
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <>
      <h1 className={TITLE_CLASSES}>{messages.home.title}</h1>
      <p className={LEAD_CLASSES}>{messages.home.lead}</p>
      <section aria-labelledby="counters-title" className={SECTION_CLASSES}>
        <h2 id="counters-title" className={SECTION_TITLE_CLASSES}>
          {counters.kind === "ok"
            ? messages.home.countersTitle(formatDay(counters.data.day))
            : messages.nav.home}
        </h2>
        {counters.kind === "loading" ? (
          <p role="status" className={HELP_CLASSES}>
            {messages.common.loading}
          </p>
        ) : counters.kind === "error" ? (
          <p role="alert" className={ERROR_CLASSES}>
            {messages.home.countersError}
          </p>
        ) : (
          <Counters counters={counters.data} />
        )}
      </section>
      <section aria-labelledby="alerts-title" className={SECTION_CLASSES}>
        <h2 id="alerts-title" className={SECTION_TITLE_CLASSES}>
          {messages.home.alertsTitle}
        </h2>
        {alerts.kind === "loading" ? (
          <p role="status" className={HELP_CLASSES}>
            {messages.common.loading}
          </p>
        ) : alerts.kind === "error" ? (
          <p role="alert" className={ERROR_CLASSES}>
            {messages.home.alertsError}
          </p>
        ) : (
          <>
            <Alerts data={alerts.data} />
            <p className={HELP_CLASSES}>
              {messages.home.evaluatedAt(
                formatDateTime(alerts.data.evaluatedAt),
              )}
            </p>
          </>
        )}
      </section>
    </>
  );
}
