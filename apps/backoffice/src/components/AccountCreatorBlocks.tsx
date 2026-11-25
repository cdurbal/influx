"use client";

// Blocks 2 to 4 of the record of a creator account (docs/mvp/07 RG71, RG4; 17b §3.6; jalons/l2g/modele.md §1
// point 13; L2G-17): the networks with their exact figures, the date of the measure and its source; the rates,
// which no one entered (D78); the portfolio as counts, with the way to its queue. The opening of the record
// journals them (RG40). A separate file so that AccountScreen.tsx only calls it (it is not to grow, L2C fiche
// § risks). No thumbnail, no caption, no band in place of a figure, no price.
import type { AccountCreator } from "@influx/contracts/backoffice-accounts";
import Link from "next/link";
import { messages } from "@/messages/fr";
import { HELP_CLASSES } from "./auth-classes";
import {
  LINK_CLASSES,
  SECTION_CLASSES,
  SECTION_TITLE,
  TABLE_CLASSES,
  TD_CLASSES,
  TH_CLASSES,
} from "./bo-classes";
import { DenseTableRegion } from "./DenseTableRegion";
import { networkRows, portfolioWords } from "./account-creator-view";
import { profileFilterHref } from "./portfolio-queue-view";

const t = messages.accountCreator;

const COLUMNS = [
  "network",
  "followers",
  "posts",
  "comments",
  "engagement",
  "measuredAt",
  "source",
] as const;

export function AccountCreatorBlocks({
  accountId,
  creator,
}: {
  accountId: string;
  creator: AccountCreator | null;
}) {
  if (creator === null) {
    return null;
  }
  const rows = networkRows(creator.networks);
  return (
    <>
      <section aria-labelledby="creator-networks" className={SECTION_CLASSES}>
        <h2 id="creator-networks" className={SECTION_TITLE}>
          {t.networksTitle}
          <span aria-hidden="true"> {t.mark}</span>
          <span className="sr-only">
            {" "}
            {messages.queueReview.parenthesized(t.markLabel)}
          </span>
        </h2>
        <p className={HELP_CLASSES}>{t.networksLead}</p>
        {rows.length === 0 ? (
          <p className={HELP_CLASSES}>{t.noNetwork}</p>
        ) : (
          <DenseTableRegion label={t.tableLabel}>
            <table className={TABLE_CLASSES}>
              <caption className="sr-only">{t.tableLabel}</caption>
              <thead>
                <tr>
                  {COLUMNS.map((column) => (
                    <th key={column} scope="col" className={TH_CLASSES}>
                      {t.columns[column]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} data-creator-network>
                    <th scope="row" className={`${TD_CLASSES} text-left`}>
                      <span className="block font-semibold">{row.network}</span>
                      {row.notes.map((note) => (
                        <span key={note} className="block text-text-secondary">
                          {note}
                        </span>
                      ))}
                    </th>
                    <td className={`${TD_CLASSES} tabular-nums`}>
                      {row.followers}
                    </td>
                    <td className={`${TD_CLASSES} tabular-nums`}>
                      {row.posts}
                    </td>
                    <td className={`${TD_CLASSES} tabular-nums`}>
                      {row.comments}
                    </td>
                    <td className={`${TD_CLASSES} tabular-nums`}>
                      {row.engagement}
                    </td>
                    <td className={`${TD_CLASSES} tabular-nums`}>
                      {row.measuredAt}
                    </td>
                    <td className={TD_CLASSES}>{row.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DenseTableRegion>
        )}
        <p className={HELP_CLASSES}>{t.historyNote}</p>
      </section>
      <section aria-labelledby="creator-rates" className={SECTION_CLASSES}>
        <h2 id="creator-rates" className={SECTION_TITLE}>
          {t.ratesTitle}
        </h2>
        <p className="text-sm text-text-primary">{t.rates}</p>
      </section>
      <section aria-labelledby="creator-portfolio" className={SECTION_CLASSES}>
        <h2 id="creator-portfolio" className={SECTION_TITLE}>
          {t.portfolioTitle}
        </h2>
        <p className="text-sm text-text-primary">
          {portfolioWords(creator.portfolio)}
        </p>
        <Link href={profileFilterHref(accountId)} className={LINK_CLASSES}>
          {t.openQueue}
        </Link>
        <p className={HELP_CLASSES}>{t.portfolioMasked}</p>
      </section>
    </>
  );
}
