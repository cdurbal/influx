"use client";

// Home of the backoffice v0 (docs/mvp/05 RG104, RG105, CA62; 15 §F; 17b §3.11, §3.14.e). The
// counters of the day and the alerts, each alert in words with its count and its start — never a
// colour alone (15 RG66). The "new browser" sign-ins (B-7, RG145) and the `admin` roles granted
// (J8S-4, RG101) reach the admins only: apps/api returns empty lists to an agent. For the admins,
// the weekly review of the confirmations made alone (PD6, J8S-1); apps/api refuses it to an agent,
// so the screen does not ask.
import type { AccountCountersResponse } from "@influx/contracts/backoffice-accounts";
import type {
  AlertsResponse,
  DegradedReviewResponse,
} from "@influx/contracts/backoffice-actions";
import Link from "next/link";
import { useEffect, useState } from "react";
import { messages } from "@/messages/fr";
import {
  HELP_CLASSES,
  LEAD_CLASSES,
  TITLE_CLASSES,
  WARNING_CLASSES,
} from "./auth-classes";
import { readAlerts, readCounters, readDegradedReview } from "./backoffice-api";
import {
  LINK_CLASSES,
  SECTION_CLASSES,
  SECTION_TITLE_CLASSES,
  TABULAR_CLASSES,
} from "./bo-classes";
import { useTeamNames } from "./DualControlScreens";
import { ServicesLink } from "./ServicesLink";
import { useMe } from "./Shell";
import {
  browserLabel,
  countryName,
  formatDateTime,
  formatDay,
  formatLongDate,
  formatTime,
  personName,
  sharePercent,
} from "./view-model";
import { ErrorNotice } from "./ErrorNotice";

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
        </Link>{" "}
        <ServicesLink />
      </li>
    </ul>
  );
}

function Alerts({ data }: { data: AlertsResponse }) {
  const t = messages.alert;
  if (
    data.alerts.length === 0 &&
    data.newBrowserSignIns.length === 0 &&
    data.adminRoleGrants.length === 0
  ) {
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
            key={`${alert.code}-${alert.cause}-${alert.destination ?? ""}-${alert.setting ?? ""}`}
            className={WARNING_CLASSES}
          >
            {t.line(
              alert.code,
              words === undefined
                ? alert.cause
                : words(
                    destination,
                    alert.count,
                    alert.setting === null
                      ? undefined
                      : messages.syncSetting[alert.setting],
                  ),
              alert.since === null ? null : formatDateTime(alert.since),
            )}{" "}
            {alert.code === "AL25" ? <ServicesLink /> : null}
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
      {data.adminRoleGrants.map((grant) => (
        <li
          key={`${grant.accountId}-${grant.grantedAt}`}
          className={WARNING_CLASSES}
        >
          <strong className="block">{t.adminGrant.title}</strong>
          {t.adminGrant.body(
            grant.firstName ?? t.newBrowser.unnamed,
            grant.grantedByFirstName ?? t.adminGrant.unknownGranter,
            formatLongDate(grant.grantedAt),
            formatTime(grant.grantedAt),
          )}
        </li>
      ))}
    </ul>
  );
}

/** PD6 (J8S-1): week by week, each confirmation made alone, in words, with its request. */
function DegradedReview() {
  const t = messages.home.degraded;
  const names = useTeamNames();
  const [review, setReview] = useState<Load<DegradedReviewResponse>>({
    kind: "loading",
  });
  useEffect(() => {
    let active = true;
    void readDegradedReview().then((result) => {
      if (active) {
        setReview(
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
    <section aria-labelledby="degraded-title" className={SECTION_CLASSES}>
      <h2 id="degraded-title" className={SECTION_TITLE_CLASSES}>
        {t.title}
      </h2>
      {review.kind === "loading" ? (
        <p role="status" className={HELP_CLASSES}>
          {messages.common.loading}
        </p>
      ) : review.kind === "error" ? (
        <ErrorNotice>{t.error}</ErrorNotice>
      ) : (
        <>
          <p className={HELP_CLASSES}>{t.lead(review.data.weeks)}</p>
          {review.data.review.length === 0 ? (
            <p className={HELP_CLASSES}>{t.empty(review.data.weeks)}</p>
          ) : (
            review.data.review.map((week) => (
              <div key={week.week} className="flex flex-col gap-1">
                <h3 className="text-sm font-semibold">
                  {t.week(week.week, week.confirmations.length)}
                </h3>
                <ul className="flex flex-col gap-1 text-sm">
                  {week.confirmations.map((confirmation) => (
                    <li key={confirmation.id}>
                      {t.line(
                        messages.dualControl.actions[confirmation.actionCode] ??
                          confirmation.actionCode,
                        messages.dualControl.reasons[confirmation.reasonCode] ??
                          confirmation.reasonCode,
                        personName(names, confirmation.requestedBy),
                        formatDateTime(confirmation.requestedAt),
                        formatDateTime(confirmation.confirmedAt),
                        confirmation.executed,
                      )}{" "}
                      <Link
                        href={`/double-validation/${confirmation.id}`}
                        className={LINK_CLASSES}
                      >
                        {t.open}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
          <p className={HELP_CLASSES}>
            {messages.home.evaluatedAt(formatDateTime(review.data.evaluatedAt))}
          </p>
        </>
      )}
    </section>
  );
}

export function HomeScreen() {
  const me = useMe();
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
          <ErrorNotice>{messages.home.countersError}</ErrorNotice>
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
          <ErrorNotice>{messages.home.alertsError}</ErrorNotice>
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
      {me.role === "admin" ? <DegradedReview /> : null}
    </>
  );
}
