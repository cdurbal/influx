"use client";

// The blocks of the decision screen of queue 3 that only read (docs/mvp/07 RG77 to RG85, RG93, RG95 to RG97; 17b
// §2.4, §2.5; jalons/l2g/modele.md §1 points 2, 10, 12; L2G-16): the visual (read on demand, journaled) beside
// the grid of RG79 as it is written, the facts of the visual and of its profile, the caption with its
// declaration, the alerts in words, how a closed entry ended. Everything an agent needs to decide is on one
// screen, the image and the grid side by side on a workstation.
import { messages } from "@/messages/fr";
import { HELP_CLASSES } from "./auth-classes";
import { readPortfolioEntryImage } from "./backoffice-api";
import {
  DD_CLASSES,
  DL_CLASSES,
  DT_CLASSES,
  SECTION_CLASSES,
  SECTION_TITLE,
  TABLE_CLASSES,
  TD_CLASSES,
  TH_CLASSES,
} from "./bo-classes";
import { CreatorVisual } from "./CreatorVisual";
import { DenseTableRegion } from "./DenseTableRegion";
import type { VisualDisplay } from "./use-visual-display";
import {
  alertLine,
  captionWords,
  closedLines,
  gridRows,
  portfolioFacts,
  type PortfolioReviewView,
} from "./portfolio-review-view";

const t = messages.portfolioReview;

/** The visual (left) and the grid of RG79 (right): the two things a moderation reads at once. */
export function VisualAndGridBlock({
  view,
  canRead,
  display,
}: {
  view: PortfolioReviewView;
  canRead: boolean;
  display: VisualDisplay;
}) {
  const rows = gridRows();
  return (
    <div className="grid items-start gap-4 lg:grid-cols-2">
      <section aria-labelledby="portfolio-visual" className={SECTION_CLASSES}>
        <h2 id="portfolio-visual" className={SECTION_TITLE}>
          {t.sections.visual}
        </h2>
        <p className={HELP_CLASSES}>
          {canRead ? t.visual.lead : t.visual.holderOnly}
        </p>
        {canRead ? (
          <div data-visual={view.item.id}>
            <CreatorVisual
              read={() => readPortfolioEntryImage(view.item.id)}
              position={t.visual.position}
              alt={t.visual.alt(view.account.alias)}
              showTicket={display.ticket}
              next={!display.shownIds.includes(view.item.id)}
              onShown={() => display.markShown(view.item.id)}
            />
          </div>
        ) : null}
      </section>

      <section aria-labelledby="portfolio-grid" className={SECTION_CLASSES}>
        <h2 id="portfolio-grid" className={SECTION_TITLE}>
          {t.sections.grid}
        </h2>
        <p className={HELP_CLASSES}>{t.grid.lead}</p>
        <DenseTableRegion label={t.grid.tableLabel}>
          <table className={TABLE_CLASSES}>
            <caption className="sr-only">{t.grid.tableLabel}</caption>
            <thead>
              <tr>
                <th scope="col" className={TH_CLASSES}>
                  {t.grid.columns.control}
                </th>
                <th scope="col" className={TH_CLASSES}>
                  {t.grid.columns.rule}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.number} data-control={row.number}>
                  <th
                    scope="row"
                    className={`${TD_CLASSES} text-left font-semibold`}
                  >
                    {row.numbered}
                  </th>
                  <td className={TD_CLASSES}>{row.rule}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </DenseTableRegion>
        <p className="text-sm font-semibold text-text-primary">
          {t.grid.captionTitle}
        </p>
        <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-text-primary">
          {t.grid.captionRows.map((row) => (
            <li key={row.code}>{row.label}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/** The facts of the visual and of its profile: an alias and a country, never a handle or a figure. */
export function FactsBlock({ view }: { view: PortfolioReviewView }) {
  return (
    <section aria-labelledby="portfolio-profile" className={SECTION_CLASSES}>
      <h2 id="portfolio-profile" className={SECTION_TITLE}>
        {t.sections.profile}
      </h2>
      <dl className={DL_CLASSES}>
        {portfolioFacts(view).map((fact) => (
          <div key={fact.key} className="contents">
            <dt className={DT_CLASSES}>{fact.label}</dt>
            <dd className={DD_CLASSES}>{fact.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** The caption (moderated text, 07 RG82) and the declaration that comes with it (RG83). */
export function CaptionBlock({ view }: { view: PortfolioReviewView }) {
  const words = captionWords(view);
  return (
    <section aria-labelledby="portfolio-caption" className={SECTION_CLASSES}>
      <h2 id="portfolio-caption" className={SECTION_TITLE}>
        {t.sections.caption}
      </h2>
      <p className="text-sm text-text-secondary">
        <span className="font-semibold text-text-primary">
          {t.caption.label}
        </span>{" "}
        <span className="whitespace-pre-wrap">{words.caption}</span>
      </p>
      <p className="text-sm text-text-primary">{words.declaration}</p>
    </section>
  );
}

/** The alerts (07 RG93; EC-L2G-12): in sentences, informative, never a refusal. */
export function AlertsBlock({ view }: { view: PortfolioReviewView }) {
  return (
    <section aria-labelledby="portfolio-alerts" className={SECTION_CLASSES}>
      <h2 id="portfolio-alerts" className={SECTION_TITLE}>
        {t.sections.alerts}
      </h2>
      {view.alerts.length === 0 ? (
        <p className="text-sm text-text-primary">{t.alerts.none}</p>
      ) : (
        <>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-text-primary">
            {view.alerts.map((alert, at) => (
              <li key={`${alert.field}-${at}`}>{alertLine(alert)}</li>
            ))}
          </ul>
          <p className={HELP_CLASSES}>{t.alerts.intro}</p>
        </>
      )}
    </section>
  );
}

/** How a closed entry ended: who, when, the reason of the grid, the comment. */
export function ClosedBlock({ view }: { view: PortfolioReviewView }) {
  const comment = view.item.decision?.internalComment ?? null;
  return (
    <section aria-labelledby="portfolio-closed" className={SECTION_CLASSES}>
      <h2 id="portfolio-closed" className={SECTION_TITLE}>
        {t.sections.decision}
      </h2>
      {closedLines(view).map((line) => (
        <p key={line} className="text-sm text-text-primary">
          {line}
        </p>
      ))}
      {comment === null ? null : (
        <div className="flex flex-col gap-1 text-sm">
          <p className="font-semibold text-text-primary">{t.closed.comment}</p>
          <p className="whitespace-pre-wrap text-text-secondary">{comment}</p>
        </div>
      )}
    </section>
  );
}
