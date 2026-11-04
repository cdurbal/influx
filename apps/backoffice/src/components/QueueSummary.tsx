"use client";

// The permanent counters of the queues on the dashboard (docs/mvp/15 RG28; 06 RG72, RG7; L2C-16):
// the volume waiting, the age of the oldest entry, those past their deadline, those nobody holds,
// and the entries past the alert threshold of age (06 RG7), in words. RG72 reaches the median delay
// and the refusals by reason only when apps/api serves them (EC-L2C-16-3); the badges are L2E's
// (EC-L2C-6). The entries past the threshold are counted from the first page of the overdue ones,
// the only ones that can be (the threshold lies beyond the deadline): "at least" when it is capped.
import { QUEUE_PAGE_SIZE_MAX } from "@influx/contracts/backoffice-queues";
import Link from "next/link";
import { useEffect, useState } from "react";
import { messages } from "@/messages/fr";
import { HELP_CLASSES, WARNING_CLASSES } from "./auth-classes";
import { readBrandReviewEntries, readQueueCounters } from "./backoffice-api";
import {
  LINK_CLASSES,
  SECTION_CLASSES,
  SECTION_TITLE,
  TABULAR_CLASSES,
} from "./bo-classes";
import { ErrorNotice } from "./ErrorNotice";
import { escalatedCount, summaryLine } from "./queue-view-model";
import type {
  EntriesResponse,
  QueueCountersResponse,
} from "@influx/contracts/backoffice-queues";

const t = messages.queueSummary;

type Summary =
  | { kind: "loading" }
  | { kind: "error" }
  | {
      kind: "ok";
      counters: QueueCountersResponse;
      overdue: EntriesResponse | null;
    };

export function QueueSummary() {
  const [summary, setSummary] = useState<Summary>({ kind: "loading" });

  useEffect(() => {
    let active = true;
    void (async () => {
      const counters = await readQueueCounters();
      if (!active) {
        return;
      }
      if (counters.kind !== "ok") {
        setSummary({ kind: "error" });
        return;
      }
      // Entries past their deadline, to find those past the threshold of age (RG7): only when
      // some are overdue, and an answer that fails leaves the counters, not the threshold line.
      const waiting = counters.data.queues.some((queue) => queue.overdue > 0);
      const overdue = waiting
        ? await readBrandReviewEntries({
            overdue: "true",
            limit: String(QUEUE_PAGE_SIZE_MAX),
          })
        : null;
      if (active) {
        setSummary({
          kind: "ok",
          counters: counters.data,
          overdue: overdue?.kind === "ok" ? overdue.data : null,
        });
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const escalated =
    summary.kind === "ok" && summary.overdue !== null
      ? escalatedCount(summary.overdue)
      : null;

  return (
    <section aria-labelledby="queues-title" className={SECTION_CLASSES}>
      <h2 id="queues-title" className={SECTION_TITLE}>
        {t.title}
      </h2>
      {summary.kind === "loading" ? (
        <p role="status" className={HELP_CLASSES}>
          {messages.common.loading}
        </p>
      ) : summary.kind === "error" ? (
        <ErrorNotice>{t.error}</ErrorNotice>
      ) : (
        <>
          <ul className={`flex flex-col gap-1 text-sm ${TABULAR_CLASSES}`}>
            {summary.counters.queues.map((queue) => (
              <li key={queue.queue}>
                {summaryLine(queue, summary.counters.asOf)}{" "}
                <Link href="/files/profils-marque" className={LINK_CLASSES}>
                  {t.open}
                </Link>
              </li>
            ))}
          </ul>
          {escalated === null || escalated.count === 0 ? null : (
            <p role="status" className={WARNING_CLASSES}>
              {t.escalated(escalated.count, escalated.atLeast)}{" "}
              <Link
                href="/files/profils-marque?overdue=true"
                className={LINK_CLASSES}
              >
                {t.seeEscalated}
              </Link>
            </p>
          )}
        </>
      )}
    </section>
  );
}
