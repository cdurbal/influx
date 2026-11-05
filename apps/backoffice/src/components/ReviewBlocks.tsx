"use client";

// The blocks of the decision screen of queue 1 that only read (docs/mvp/17b §2.5, §4.8, §4.9; 06 RG9,
// RG19, RG25, RG70; 15 RG123; jalons/l2c/file.md A3, A4, A7; L2C-17): the brand as validated, the logo
// (its characteristics: no route serves its bytes yet), the validated version against the proposed
// one, the alerts in words, the contact person behind a logged opening, how a closed entry ended.
// Everything an agent needs to decide is here, without another screen (invariant 1 of the template).
import type { OpenEntryResponse } from "@influx/contracts/backoffice-queues";
import { messages } from "@/messages/fr";
import { HELP_CLASSES } from "./auth-classes";
import {
  BLOCK_TITLE,
  DD_CLASSES,
  DL_CLASSES,
  DT_CLASSES,
  SECTION_CLASSES,
  SECTION_TITLE,
  TABLE_CLASSES,
  TD_CLASSES,
  TH_CLASSES,
} from "./bo-classes";
import { DenseTableRegion } from "./DenseTableRegion";
import {
  alertLine,
  contactFacts,
  fieldLabel,
  logoFacts,
  profileFacts,
  revisionRows,
  type ChangeSet,
} from "./queue-review-facts";
import { closedLines } from "./queue-review-view";

const t = messages.queueReview;

/** The mention next to a line that moved between two readings (L2BS-1): written, never a colour. */
function ChangedMark({ shown }: { shown: boolean }) {
  return shown ? (
    <strong className="ml-2 text-feedback-warning-text">
      {t.parenthesized(t.modifiedAfter)}
    </strong>
  ) : null;
}

/** Block ① — the brand as validated (06 RG9: the live row is always the last validated version). */
export function BrandBlock({
  view,
  changes,
}: {
  view: OpenEntryResponse;
  changes: ChangeSet | null;
}) {
  const proposed = new Set(
    view.revisions.map((revision) => revision.fieldCode),
  );
  const logos = logoFacts(view.profile);
  return (
    <section aria-labelledby="review-brand" className={SECTION_CLASSES}>
      <h2 id="review-brand" className={SECTION_TITLE}>
        {t.sections.brand}
      </h2>
      <dl className={DL_CLASSES}>
        {profileFacts(view).map((fact) => (
          <div key={fact.key} className="contents">
            <dt className={DT_CLASSES}>{fact.label}</dt>
            <dd
              className={`${DD_CLASSES}${fact.multiline ? " whitespace-pre-wrap" : ""}`}
            >
              {fact.value}
              {fact.field !== null && proposed.has(fact.field) ? (
                <span className="ml-2 text-text-secondary">
                  {t.parenthesized(t.pendingChange)}
                </span>
              ) : null}
              <ChangedMark shown={changes?.keys.has(fact.key) === true} />
            </dd>
          </div>
        ))}
      </dl>
      <h3 className={BLOCK_TITLE}>{t.sections.logos}</h3>
      <dl className={DL_CLASSES}>
        {logos.map((logo) => (
          <div key={logo.key} className="contents">
            <dt className={DT_CLASSES}>{logo.label}</dt>
            <dd className={DD_CLASSES}>
              {logo.line}
              <ChangedMark
                shown={changes?.keys.has(`logo.${logo.key}`) === true}
              />
            </dd>
          </div>
        ))}
      </dl>
      <p className={HELP_CLASSES}>{t.logo.notShown}</p>
    </section>
  );
}

/** Block ③ — what was written: the validated version next to the proposed one, or the whole profile. */
export function WrittenBlock({
  view,
  changes,
}: {
  view: OpenEntryResponse;
  changes: ChangeSet | null;
}) {
  const rows = revisionRows(view.revisions);
  return (
    <section aria-labelledby="review-written" className={SECTION_CLASSES}>
      <h2 id="review-written" className={SECTION_TITLE}>
        {t.sections.written}
      </h2>
      {view.entry.kind === "submission" ? (
        <p className="text-sm text-text-primary">{t.written.submission}</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-text-primary">{t.written.noRevision}</p>
      ) : (
        <DenseTableRegion label={t.written.tableLabel}>
          <table className={TABLE_CLASSES}>
            <caption className="sr-only">{t.written.tableLabel}</caption>
            <thead>
              <tr>
                <th scope="col" className={TH_CLASSES}>
                  {t.written.columns.field}
                </th>
                <th scope="col" className={TH_CLASSES}>
                  {t.written.columns.validated}
                </th>
                <th scope="col" className={TH_CLASSES}>
                  {t.written.columns.proposed}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <th
                    scope="row"
                    className={`${TD_CLASSES} text-left font-semibold`}
                  >
                    {fieldLabel(row.field)}
                  </th>
                  <td
                    className={`${TD_CLASSES}${row.multiline ? " whitespace-pre-wrap" : ""}`}
                  >
                    {row.validated}
                  </td>
                  <td
                    className={`${TD_CLASSES}${row.multiline ? " whitespace-pre-wrap" : ""}`}
                  >
                    {row.proposed}
                    <ChangedMark
                      shown={
                        changes?.keys.has(`revision.${row.field}`) === true
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DenseTableRegion>
      )}
    </section>
  );
}

/** Block ④ — the alerts (RG19, RG25, RG70, L2BS-8): in sentences, informative, never a refusal. */
export function AlertsBlock({ view }: { view: OpenEntryResponse }) {
  return (
    <section aria-labelledby="review-alerts" className={SECTION_CLASSES}>
      <h2 id="review-alerts" className={SECTION_TITLE}>
        {t.sections.alerts}
      </h2>
      {view.alerts.length === 0 ? (
        <p className="text-sm text-text-primary">{t.alerts.none}</p>
      ) : (
        <>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-text-primary">
            {view.alerts.map((alert, at) => (
              <li key={`${alert.code}-${at}`}>{alertLine(alert)}</li>
            ))}
          </ul>
          <p className={HELP_CLASSES}>{t.alerts.intro}</p>
        </>
      )}
    </section>
  );
}

/** The contact person (L2BS-7; D45, D46): seen here only, and the opening that served it is logged. */
export function ContactBlock({ view }: { view: OpenEntryResponse }) {
  return (
    <section aria-labelledby="review-contact" className={SECTION_CLASSES}>
      <h2 id="review-contact" className={SECTION_TITLE}>
        {t.sections.contact}
        <span aria-hidden="true"> {t.mark}</span>
        <span className="sr-only"> {t.parenthesized(t.markerLabel)}</span>
      </h2>
      <p className={HELP_CLASSES}>{t.contact.lead}</p>
      <dl className={DL_CLASSES}>
        {contactFacts(view.profile.contact).map((line) => (
          <div key={line.key} className="contents">
            <dt className={DT_CLASSES}>{line.label}</dt>
            <dd className={`${DD_CLASSES} break-all`}>{line.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** How a closed entry ended: who, when, the reason, the message the brand received, the comment. */
export function ClosedBlock({ view }: { view: OpenEntryResponse }) {
  const decision = view.entry.decision;
  return (
    <section aria-labelledby="review-closed" className={SECTION_CLASSES}>
      <h2 id="review-closed" className={SECTION_TITLE}>
        {t.sections.decision}
      </h2>
      {closedLines(view).map((line) => (
        <p key={line} className="text-sm text-text-primary">
          {line}
        </p>
      ))}
      {decision?.memberMessage == null ? null : (
        <div className="flex flex-col gap-1 text-sm">
          <p className="font-semibold text-text-primary">{t.closed.message}</p>
          <p className="whitespace-pre-wrap text-text-secondary">
            {decision.memberMessage}
          </p>
        </div>
      )}
      {decision?.internalComment == null ? null : (
        <div className="flex flex-col gap-1 text-sm">
          <p className="font-semibold text-text-primary">{t.closed.comment}</p>
          <p className="whitespace-pre-wrap text-text-secondary">
            {decision.internalComment}
          </p>
        </div>
      )}
    </section>
  );
}
