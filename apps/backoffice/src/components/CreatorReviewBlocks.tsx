"use client";

// The blocks of the decision screen of queue 2 that only read (docs/mvp/07 RG9, RG10, RG49, RG77, RG93 to
// RG96; 17b §2.4, §2.5; jalons/l2g/modele.md §1 points 6, 10, 12; L2G-15): the profile as validated, the
// network lines with their exact figures (layer I, marked: the opening that served them is logged), the
// revisions side by side with the validated version, the visuals (read on demand), the alerts in words, how a
// closed entry ended. Everything an agent needs to decide is here, without another screen.
import type {
  CreatorReviewedProfile,
  OpenCreatorEntryResponse,
} from "@influx/contracts/creator-queues";
import { messages } from "@/messages/fr";
import { HELP_CLASSES } from "./auth-classes";
import { readCreatorEntryVisual } from "./backoffice-api";
import {
  BLOCK_TITLE,
  DD_CLASSES,
  DL_CLASSES,
  DT_CLASSES,
  MONO_CLASSES,
  SECTION_CLASSES,
  SECTION_TITLE,
  TABLE_CLASSES,
  TD_CLASSES,
  TH_CLASSES,
} from "./bo-classes";
import {
  alertLine,
  closedLines,
  lineView,
  modifiedFieldsWords,
  profileFacts,
  revisionRows,
  visualFacts,
  visualName,
} from "./creator-review-view";
import { CreatorVisual } from "./CreatorVisual";
import { DenseTableRegion } from "./DenseTableRegion";

const t = messages.creatorReview;

/** Block ① — the profile as validated (07 RG9: the live rows are always the last validated version). */
export function ProfileBlock({ view }: { view: OpenCreatorEntryResponse }) {
  const proposed = new Set(view.revisions.map((revision) => revision.field));
  return (
    <section aria-labelledby="creator-profile" className={SECTION_CLASSES}>
      <h2 id="creator-profile" className={SECTION_TITLE}>
        {t.sections.profile}
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
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** Block ② — the network lines, layer I: marked, as the contact person of a brand is (D45, D46). */
export function LinesBlock({ profile }: { profile: CreatorReviewedProfile }) {
  return (
    <section aria-labelledby="creator-lines" className={SECTION_CLASSES}>
      <h2 id="creator-lines" className={SECTION_TITLE}>
        {t.sections.lines}
        <span aria-hidden="true"> {t.mark}</span>
        <span className="sr-only"> {t.parenthesized(t.markerLabel)}</span>
      </h2>
      <p className={HELP_CLASSES}>{t.lines.lead}</p>
      {profile.lines.length === 0 ? (
        <p className="text-sm text-text-primary">{t.lines.none}</p>
      ) : (
        profile.lines.map((line) => {
          const shown = lineView(line);
          return (
            <div key={shown.id} className="flex flex-col gap-2">
              <h3 className={BLOCK_TITLE}>{shown.title}</h3>
              <dl className={DL_CLASSES}>
                {shown.facts.map((fact) => (
                  <div key={fact.key} className="contents">
                    <dt className={DT_CLASSES}>{fact.label}</dt>
                    <dd className={fact.mono ? MONO_CLASSES : DD_CLASSES}>
                      {fact.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          );
        })
      )}
    </section>
  );
}

/** Block ③ — what changed: the validated version next to the proposed one, or the whole profile. */
export function WrittenBlock({ view }: { view: OpenCreatorEntryResponse }) {
  const rows = revisionRows(view);
  const summary = modifiedFieldsWords(view);
  return (
    <section aria-labelledby="creator-written" className={SECTION_CLASSES}>
      <h2 id="creator-written" className={SECTION_TITLE}>
        {t.sections.written}
      </h2>
      {view.entry.kind === "submission" ? (
        <p className="text-sm text-text-primary">{t.written.submission}</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-text-primary">{t.written.none}</p>
      ) : (
        <>
          {summary === null ? null : (
            <p className="text-sm font-semibold text-text-primary">{summary}</p>
          )}
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
                      {row.label}
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
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DenseTableRegion>
        </>
      )}
    </section>
  );
}

/**
 * Block ④ — the visuals that count for the decision (pending or approved). Their moderation is queue 3's:
 * here they are read, one at a time and on demand, by the holder of the entry (D82 (7)).
 */
export function VisualsBlock({
  view,
  canRead,
}: {
  view: OpenCreatorEntryResponse;
  canRead: boolean;
}) {
  const { visuals } = view.profile;
  return (
    <section aria-labelledby="creator-visuals" className={SECTION_CLASSES}>
      <h2 id="creator-visuals" className={SECTION_TITLE}>
        {t.sections.visuals}
      </h2>
      <p className={HELP_CLASSES}>{t.visuals.lead}</p>
      {visuals.length === 0 ? (
        <p className="text-sm text-text-primary">{t.visuals.none}</p>
      ) : (
        <>
          <p className={HELP_CLASSES}>
            {canRead ? t.visuals.showHelp : t.visuals.holderOnly}
          </p>
          <ul className="flex flex-col gap-4">
            {visuals.map((visual) => {
              const position = visualName(visuals, visual.id);
              return (
                <li
                  key={visual.id}
                  data-visual={visual.id}
                  className="flex flex-col gap-2"
                >
                  <p className="text-sm text-text-primary">
                    <span className="font-semibold">{position}</span>
                    {t.visuals.separator}
                    {visualFacts(visual).slice(1).join(t.visuals.separator)}
                  </p>
                  <p className="text-sm text-text-secondary">
                    <span className="font-semibold">
                      {t.visuals.captionLabel}
                    </span>{" "}
                    <span className="whitespace-pre-wrap">
                      {visual.caption ?? t.visuals.noCaption}
                    </span>
                  </p>
                  {canRead ? (
                    <CreatorVisual
                      read={() =>
                        readCreatorEntryVisual(view.entry.id, visual.id)
                      }
                      position={position}
                      alt={t.visuals.alt(position, view.profile.alias)}
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}

/** Block ⑤ — the alerts (07 RG93; EC-L2G-12): in sentences, informative, never a refusal. */
export function AlertsBlock({ view }: { view: OpenCreatorEntryResponse }) {
  return (
    <section aria-labelledby="creator-alerts" className={SECTION_CLASSES}>
      <h2 id="creator-alerts" className={SECTION_TITLE}>
        {t.sections.alerts}
      </h2>
      {view.alerts.length === 0 ? (
        <p className="text-sm text-text-primary">{t.alerts.none}</p>
      ) : (
        <>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-text-primary">
            {view.alerts.map((alert, at) => (
              <li key={`${alert.field}-${alert.rowKey ?? ""}-${at}`}>
                {alertLine(alert, view.profile.visuals)}
              </li>
            ))}
          </ul>
          <p className={HELP_CLASSES}>{t.alerts.intro}</p>
        </>
      )}
    </section>
  );
}

/** How a closed entry ended: who, when, the reason, the message the creator received, the comment. */
export function ClosedBlock({ view }: { view: OpenCreatorEntryResponse }) {
  const decision = view.entry.decision;
  return (
    <section aria-labelledby="creator-closed" className={SECTION_CLASSES}>
      <h2 id="creator-closed" className={SECTION_TITLE}>
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
