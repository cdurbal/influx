"use client";

// Blocks 2 and 3 of the record of a brand account (docs/mvp/15 RG41, RG123; 17b §3.5; L2C-18): the
// contact person, behind the journal line of the opening, and the profile with its decisions. A
// separate file so that AccountScreen.tsx only calls it (it is not to grow, L2C fiche § risks).
// Blocks 4 to 7 and 9 are not drawn: no empty shell (they come with Lots 3 to 5). No button of
// correction: RG71 waits for Lot 5.
import {
  ACCOUNT_BRAND_DECISIONS_MAX,
  type AccountBrand,
} from "@influx/contracts/backoffice-accounts";
import { messages } from "@/messages/fr";
import { HELP_CLASSES } from "./auth-classes";
import {
  BLOCK_TITLE,
  DD_CLASSES,
  DL_CLASSES,
  DT_CLASSES,
  SECTION_CLASSES,
  SECTION_TITLE,
} from "./bo-classes";
import {
  brandContactLines,
  brandProfileLines,
  decisionLines,
} from "./account-brand-view";

const t = messages.accountBrand;

export function AccountBrandBlocks({ brand }: { brand: AccountBrand | null }) {
  if (brand === null) {
    return null;
  }
  const decisions = decisionLines(brand.profile.decisions);
  return (
    <>
      <section aria-labelledby="brand-contact" className={SECTION_CLASSES}>
        <h2 id="brand-contact" className={SECTION_TITLE}>
          {t.contactTitle}
          <span aria-hidden="true"> {t.contactMark}</span>
          <span className="sr-only">
            {" "}
            {messages.queueReview.parenthesized(t.contactMarkLabel)}
          </span>
        </h2>
        <p className={HELP_CLASSES}>{t.contactLead}</p>
        <dl className={DL_CLASSES}>
          {brandContactLines(brand.contact).map((line) => (
            <div key={line.key} className="contents">
              <dt className={DT_CLASSES}>{line.label}</dt>
              <dd className={`${DD_CLASSES} break-all`}>{line.value}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section aria-labelledby="brand-profile" className={SECTION_CLASSES}>
        <h2 id="brand-profile" className={SECTION_TITLE}>
          {t.profileTitle}
        </h2>
        <dl className={DL_CLASSES}>
          {brandProfileLines(brand.profile).map((line) => (
            <div key={line.key} className="contents">
              <dt className={DT_CLASSES}>{line.label}</dt>
              <dd className={DD_CLASSES}>{line.value}</dd>
            </div>
          ))}
        </dl>
        <h3 className={BLOCK_TITLE}>{t.decisionsTitle}</h3>
        {decisions.length === 0 ? (
          <p className={HELP_CLASSES}>{t.decisionsEmpty}</p>
        ) : (
          <ol className="flex flex-col gap-1 text-sm text-text-primary">
            {decisions.map((decision) => (
              <li key={decision.key}>{decision.line}</li>
            ))}
          </ol>
        )}
        {brand.profile.hasMoreDecisions ? (
          <p className={HELP_CLASSES}>{t.more(ACCOUNT_BRAND_DECISIONS_MAX)}</p>
        ) : null}
        <p className={HELP_CLASSES}>{t.masked}</p>
      </section>
    </>
  );
}
