"use client";

// The permanent counters of the queues on the dashboard (docs/mvp/15 RG28; 06 RG72, RG7; 08 RG66; L2C-16,
// L2E-21): the volume waiting, the age of the oldest entry, those past their deadline, those nobody holds,
// and the entries past the alert threshold of age (06 RG7), in words, for queue 1 and the two views of
// queue 4. RG72 reaches the median delay and the refusals by reason only when apps/api serves them
// (EC-L2C-16-3). The entries past the threshold are counted from the first page of the overdue ones of
// each queue, the only ones that can be (the threshold lies beyond the deadline): "at least" when capped.
import {
  BRAND_REVIEW_QUEUE,
  QUEUE_PAGE_SIZE_MAX,
  VERIFICATION_BRANDS_QUEUE,
  VERIFICATION_CREATORS_QUEUE,
  type QueueCode,
} from "@influx/contracts/backoffice-queues";
import Link from "next/link";
import { useEffect, useState } from "react";
import { messages } from "@/messages/fr";
import { HELP_CLASSES, WARNING_CLASSES } from "./auth-classes";
import {
  readBrandReviewEntries,
  readQueueCounters,
  readVerificationEntries,
} from "./backoffice-api";
import {
  LINK_CLASSES,
  SECTION_CLASSES,
  SECTION_TITLE,
  TABULAR_CLASSES,
} from "./bo-classes";
import { ErrorNotice } from "./ErrorNotice";
import { escalatedCount, QUEUE_ADDRESS, summaryLine } from "./queue-view-model";
import type { QueueCountersResponse } from "@influx/contracts/backoffice-queues";

const t = messages.queueSummary;

/** The entries of a queue past their deadline, as far as the first page tells (RG7 counts from it). */
type Overdue = { queue: QueueCode; page: Parameters<typeof escalatedCount>[0] };

type Summary =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "ok"; counters: QueueCountersResponse; overdue: Overdue[] };

/** The first page of the overdue entries of a queue, or nothing when its answer fails. */
async function overdueOf(queue: QueueCode): Promise<Overdue | null> {
  const query = { overdue: "true", limit: String(QUEUE_PAGE_SIZE_MAX) };
  const result =
    queue === BRAND_REVIEW_QUEUE
      ? await readBrandReviewEntries(query)
      : await readVerificationEntries(
          queue === VERIFICATION_CREATORS_QUEUE ? "creators" : "brands",
          query,
        );
  return result.kind === "ok" ? { queue, page: result.data } : null;
}

const QUEUES_SHOWN: readonly QueueCode[] = [
  BRAND_REVIEW_QUEUE,
  VERIFICATION_CREATORS_QUEUE,
  VERIFICATION_BRANDS_QUEUE,
];

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
      // Entries past their deadline, to find those past the threshold of age (RG7): only for the queues
      // that have some overdue, and an answer that fails leaves the counters, not the threshold line.
      const queues = counters.data.queues.filter((queue) =>
        QUEUES_SHOWN.includes(queue.queue),
      );
      const waiting = queues.filter((queue) => queue.overdue > 0);
      const overdue = (
        await Promise.all(waiting.map((queue) => overdueOf(queue.queue)))
      ).filter((entry): entry is Overdue => entry !== null);
      if (active) {
        setSummary({
          kind: "ok",
          counters: { ...counters.data, queues },
          overdue,
        });
      }
    })();
    return () => {
      active = false;
    };
  }, []);

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
                <Link
                  href={QUEUE_ADDRESS[queue.queue]}
                  aria-label={t.openOf(messages.queue[queue.queue])}
                  className={LINK_CLASSES}
                >
                  {t.open}
                </Link>
              </li>
            ))}
          </ul>
          {summary.overdue.map(({ queue, page }) => {
            const escalated = escalatedCount(page);
            if (escalated.count === 0) {
              return null;
            }
            const name = messages.queue[queue];
            return (
              <p key={queue} role="status" className={WARNING_CLASSES}>
                {t.escalatedOf(
                  name,
                  t.escalated(escalated.count, escalated.atLeast),
                )}{" "}
                <Link
                  href={`${QUEUE_ADDRESS[queue]}?overdue=true`}
                  aria-label={t.seeEscalatedOf(name)}
                  className={LINK_CLASSES}
                >
                  {t.seeEscalated}
                </Link>
              </p>
            );
          })}
        </>
      )}
    </section>
  );
}
