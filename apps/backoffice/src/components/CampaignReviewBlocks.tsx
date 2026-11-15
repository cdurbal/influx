"use client";

// The blocks of the decision screen of queue 7 that only read (docs/mvp/09 RG5, RG21 to RG23, RG85, RG87, RG95;
// 17b §3.8; jalons/l3c/modele.md §1; L3C-08): the brand and the alert of duplicate (block ①), the campaign (②),
// the brief in plain text, never cut (③), the alerts of detection (④), how a closed entry ended, and the opinion
// of the first examiner (to the holder of the live claim only). Everything an agent needs to decide is here,
// without another screen. The budget is read by the label of its band alone (D78): no figure, no total.
import type { OpenCampaignEntryResponse } from "@influx/contracts/campaign-review";
import { messages } from "@/messages/fr";
import { cn, HELP_CLASSES } from "./auth-classes";
import {
  DD_CLASSES,
  DL_CLASSES,
  DT_CLASSES,
  SECTION_CLASSES,
  SECTION_TITLE,
} from "./bo-classes";
import {
  alertLine,
  brandFacts,
  briefOf,
  campaignFacts,
  closedLines,
  duplicateLine,
  firstOpinionOf,
  type Fact,
} from "./campaign-review-view";
import type { ClaimedMode } from "./claimed-entry-view";
import { FlagIcon } from "./icons";

const t = messages.campaignReview;

/** The brief in a frame of its own: plain text, every line break kept, long words broken, never cut. */
const BRIEF_CLASSES = cn(
  "rounded-md border-(length:--border-width-thin) border-border-default bg-surface-page p-3",
  "text-sm break-words whitespace-pre-wrap text-text-primary",
);

function FactList({ facts }: { facts: readonly Fact[] }) {
  return (
    <dl className={DL_CLASSES}>
      {facts.map((fact) => (
        <div key={fact.key} className="contents">
          <dt className={DT_CLASSES}>{fact.label}</dt>
          <dd
            className={`${DD_CLASSES}${fact.multiline ? " whitespace-pre-wrap" : ""}`}
          >
            {fact.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Block ① — the brand, and the campaign of the same brand a duplicate alert points at (09 RG95). */
export function BrandBlock({ view }: { view: OpenCampaignEntryResponse }) {
  const duplicate = duplicateLine(view);
  return (
    <section aria-labelledby="campaign-brand" className={SECTION_CLASSES}>
      <h2 id="campaign-brand" className={SECTION_TITLE}>
        {t.sections.brand}
      </h2>
      <FactList facts={brandFacts(view)} />
      {duplicate === null ? null : (
        <p className="flex items-start gap-2 text-sm text-text-primary">
          <FlagIcon
            aria-hidden="true"
            className="size-(--size-icon-md) shrink-0 text-feedback-warning-icon"
          />
          <span>{duplicate}</span>
        </p>
      )}
    </section>
  );
}

/** Block ② — the campaign as submitted; the budget is its band by its label alone (D78). */
export function CampaignBlock({ view }: { view: OpenCampaignEntryResponse }) {
  return (
    <section aria-labelledby="campaign-fields" className={SECTION_CLASSES}>
      <h2 id="campaign-fields" className={SECTION_TITLE}>
        {t.sections.campaign}
      </h2>
      <FactList facts={campaignFacts(view)} />
      <p className={HELP_CLASSES}>{t.budgetNote}</p>
    </section>
  );
}

/** Block ③ — the brief, whole, as plain text: a text node, never markup, never truncated (17b §3.8). */
export function BriefBlock({ view }: { view: OpenCampaignEntryResponse }) {
  const brief = briefOf(view);
  return (
    <section aria-labelledby="campaign-brief" className={SECTION_CLASSES}>
      <h2 id="campaign-brief" className={SECTION_TITLE}>
        {t.sections.brief}
      </h2>
      <p className={HELP_CLASSES}>{t.brief.lead}</p>
      {brief === null ? (
        <p className="text-sm text-text-primary">{t.brief.empty}</p>
      ) : (
        <p data-campaign-brief className={BRIEF_CLASSES}>
          {brief}
        </p>
      )}
    </section>
  );
}

/** Block ④ — the alerts of detection (09 RG21 to RG23): in sentences, informative, never a refusal. */
export function AlertsBlock({ view }: { view: OpenCampaignEntryResponse }) {
  return (
    <section aria-labelledby="campaign-alerts" className={SECTION_CLASSES}>
      <h2 id="campaign-alerts" className={SECTION_TITLE}>
        {t.sections.alerts}
      </h2>
      {view.alerts.length === 0 ? (
        <p className="text-sm text-text-primary">{t.alerts.none}</p>
      ) : (
        <>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-text-primary">
            {view.alerts.map((alert, at) => (
              <li
                key={`${alert.code}-${alert.field}-${alert.position ?? ""}-${at}`}
              >
                {alertLine(alert)}
              </li>
            ))}
          </ul>
          <p className={HELP_CLASSES}>{t.alerts.intro}</p>
        </>
      )}
    </section>
  );
}

/**
 * The opinion of the first examiner (modele §1): served to the holder of the live claim only. A reader who is
 * not the holder is told so, rather than shown a block that looks empty.
 */
export function FirstOpinionBlock({
  view,
  mode,
}: {
  view: OpenCampaignEntryResponse;
  mode: ClaimedMode;
}) {
  if (view.entry.review.phase !== "second" || mode === "closed") {
    return null;
  }
  const opinion = firstOpinionOf(view);
  return (
    <section aria-labelledby="campaign-opinion" className={SECTION_CLASSES}>
      <h2 id="campaign-opinion" className={SECTION_TITLE}>
        {t.enhanced.opinionTitle}
      </h2>
      {opinion === null ? (
        <p className="text-sm text-text-primary">
          {t.enhanced.opinionHolderOnly}
        </p>
      ) : (
        <>
          <p
            data-first-opinion
            className="text-sm whitespace-pre-wrap text-text-primary"
          >
            {opinion}
          </p>
          <p className={HELP_CLASSES}>{t.enhanced.opinionNote}</p>
        </>
      )}
    </section>
  );
}

/** How a closed entry ended: who, when, the reason, the message the brand received. */
export function ClosedBlock({ view }: { view: OpenCampaignEntryResponse }) {
  const decision = view.entry.decision;
  return (
    <section aria-labelledby="campaign-closed" className={SECTION_CLASSES}>
      <h2 id="campaign-closed" className={SECTION_TITLE}>
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
    </section>
  );
}
