"use client";

// The "Santé technique" screen (docs/mvp/02 §20.5, "Écran « Santé technique »"; 15 RG165; 17b §2;
// 21 §J9 commit 9, EC-J9-5): availability measured by the probe, the open technical alerts, the
// worker, the error groups, the calls / p95 / error rate per route, the processes and the
// connections of the base. ADMINS ONLY, READ ONLY, workstation only (it is not in the limited phone
// view of D58: on a phone the alert e-mail is enough). The sections read apart, so that one that
// fails leaves the others readable; the whole screen is read again every minute or on request.
// An agent who reaches the address is refused by apps/api (and the attempt journaled): the screen
// then asks once, to leave that trace, and says it is refused.
import { useEffect, useState } from "react";
import { messages } from "@/messages/fr";
import { ERROR_CLASSES, HELP_CLASSES, TITLE_CLASSES } from "./auth-classes";
import { readOpsStatus } from "./backoffice-api";
import { SMALL_SECONDARY_CLASSES } from "./bo-classes";
import { ErrorsSection } from "./HealthErrors";
import { ProcessesSection } from "./HealthProcesses";
import { StatusSections } from "./HealthStatus";
import { TrafficSection } from "./HealthTraffic";
import { useMe } from "./Shell";
import { formatTime } from "./view-model";

const t = messages.health;

/** The screen is read again every minute: the probe and the samples are written at that pace. */
const REFRESH_EVERY_MS = 60_000;

function Refused() {
  // one call, for the trace of the attempt (05 CA63); the answer is the refusal
  useEffect(() => {
    void readOpsStatus();
  }, []);
  return (
    <>
      <h1 className={TITLE_CLASSES}>{t.title}</h1>
      <p role="alert" className={ERROR_CLASSES}>
        {t.forbidden}
      </p>
    </>
  );
}

function Health() {
  const [refresh, setRefresh] = useState(0);
  const [refreshedAt, setRefreshedAt] = useState(() => new Date());

  function again() {
    setRefresh((count) => count + 1);
    setRefreshedAt(new Date());
  }

  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") {
        setRefresh((count) => count + 1);
        setRefreshedAt(new Date());
      }
    }, REFRESH_EVERY_MS);
    return () => clearInterval(timer);
  }, []);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className={TITLE_CLASSES}>{t.title}</h1>
        <div className="flex flex-wrap items-center gap-3">
          <p className={HELP_CLASSES}>
            {t.refreshedAt(formatTime(refreshedAt.toISOString()))}
          </p>
          <button
            type="button"
            onClick={again}
            className={SMALL_SECONDARY_CLASSES}
          >
            {t.refresh}
          </button>
        </div>
      </div>
      <p className={HELP_CLASSES}>{t.lead}</p>
      <p className={`md:hidden ${HELP_CLASSES}`}>{t.workstation}</p>
      <StatusSections refresh={refresh} />
      <ErrorsSection refresh={refresh} />
      <TrafficSection refresh={refresh} />
      <ProcessesSection refresh={refresh} />
    </>
  );
}

export function HealthScreen() {
  const me = useMe();
  return me.role === "admin" ? <Health /> : <Refused />;
}
