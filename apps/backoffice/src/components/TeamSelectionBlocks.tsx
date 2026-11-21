"use client";

// The blocks of the screen of a request of queue 9 that only read (docs/mvp/10 RG61, RG84; 15 C1, RG36; 17b I13;
// jalons/l3g/modele.md §5; l3g-fiche invariants 11, 12; L3G-13): the request (brand, campaign of origin, dates),
// the criteria the brand entered, its message as plain text and, once closed, how it ended. The message is a text
// node in a frame of its own, `dir="auto"`, every line break kept, long words broken, never cut: a hidden control
// character cannot reorder what is around it (L3FS-7: the server neutralizes them, `plainText` does it again).
// No amount, no tariff, no creator, no export (D48, D78).
import Link from "next/link";
import { messages } from "@/messages/fr";
import { cn, HELP_CLASSES } from "./auth-classes";
import { LINK_CLASSES, SECTION_CLASSES, SECTION_TITLE } from "./bo-classes";
import { type Fact } from "./campaign-review-view";
import { FactList } from "./CampaignReviewBlocks";
import { accountHref } from "./campaign-record-view";
import {
  compatibleHref,
  IDENTIFIED_SEARCH_HREF,
} from "./identified-search-view";
import {
  closureWords,
  criteriaTexts,
  plainText,
  type TeamSelectionView,
} from "./team-selection-view";
import { formatDateTime } from "./view-model";

const t = messages.teamSelectionReview;

/** The message in a frame of its own (as the brief of a campaign): plain text, line breaks kept, never cut. */
const MESSAGE_CLASSES = cn(
  "rounded-md border-(length:--border-width-thin) border-border-default bg-surface-page p-3",
  "text-sm break-words whitespace-pre-wrap text-text-primary",
);

function requestFacts(view: TeamSelectionView): Fact[] {
  const { request } = view;
  const brand =
    request.brandName === null || request.brandName.trim() === ""
      ? messages.teamSelectionQueue.unknownBrand
      : plainText(request.brandName);
  const campaign =
    request.campaign === null
      ? t.noCampaign
      : request.campaign.title === null
        ? t.untitledCampaign
        : plainText(request.campaign.title);
  return [
    { key: "brand", label: t.brand, value: brand, multiline: false },
    { key: "campaign", label: t.campaign, value: campaign, multiline: false },
    {
      key: "createdAt",
      label: t.createdAt,
      value: formatDateTime(request.createdAt),
      multiline: false,
    },
    {
      key: "slaDueAt",
      label: t.deadline,
      value: formatDateTime(request.slaDueAt),
      multiline: false,
    },
  ];
}

/** Block ① — the request: who asked, from which campaign, when, and the ways on to the account and the search. */
export function RequestBlock({ view }: { view: TeamSelectionView }) {
  const { request } = view;
  return (
    <section aria-labelledby="selection-request" className={SECTION_CLASSES}>
      <h2 id="selection-request" className={SECTION_TITLE}>
        {t.sections.request}
      </h2>
      <FactList facts={requestFacts(view)} />
      <div className="flex flex-wrap gap-4 text-sm">
        <Link
          href={accountHref(request.advertiserAccountId)}
          className={LINK_CLASSES}
        >
          {t.openBrand}
        </Link>
        <Link
          href={
            request.campaign === null
              ? IDENTIFIED_SEARCH_HREF
              : compatibleHref(request.campaign.id)
          }
          className={LINK_CLASSES}
        >
          {request.campaign === null ? t.searchFree : t.searchCompatible}
        </Link>
      </div>
    </section>
  );
}

/** Block ② — the criteria the brand entered, one line each; none says so. */
export function CriteriaBlock({ view }: { view: TeamSelectionView }) {
  const criteria = criteriaTexts(view.request);
  return (
    <section aria-labelledby="selection-criteria" className={SECTION_CLASSES}>
      <h2 id="selection-criteria" className={SECTION_TITLE}>
        {t.sections.criteria}
      </h2>
      {criteria.length === 0 ? (
        <p className="text-sm text-text-primary">{t.criteriaNone}</p>
      ) : (
        <ul
          data-selection-criteria
          className="list-disc pl-6 text-sm text-text-primary"
        >
          {criteria.map((text) => (
            <li key={text}>{text}</li>
          ))}
        </ul>
      )}
      <p className={HELP_CLASSES}>{t.criteriaHelp}</p>
    </section>
  );
}

/** Block ③ — the message of the brand: plain text, `dir="auto"`, bidirectional controls removed (L3FS-7). */
export function MessageBlock({ view }: { view: TeamSelectionView }) {
  const { message } = view.request;
  return (
    <section aria-labelledby="selection-message" className={SECTION_CLASSES}>
      <h2 id="selection-message" className={SECTION_TITLE}>
        {t.sections.message}
      </h2>
      {message === null || plainText(message).trim() === "" ? (
        <p className="text-sm text-text-primary">{t.messageNone}</p>
      ) : (
        <p data-selection-message dir="auto" className={MESSAGE_CLASSES}>
          {plainText(message)}
        </p>
      )}
      <p className={HELP_CLASSES}>{t.messageHelp}</p>
    </section>
  );
}

/** Block ④ — how a closed request ended: when, by whom, the reason, and the comment of « Autre ». */
export function ClosureBlock({ view }: { view: TeamSelectionView }) {
  const { closure } = view.request;
  if (closure === null) {
    return null;
  }
  const words = closureWords(closure);
  return (
    <section aria-labelledby="selection-closure" className={SECTION_CLASSES}>
      <h2 id="selection-closure" className={SECTION_TITLE}>
        {t.sections.closure}
      </h2>
      <p data-selection-closure className="text-sm text-text-primary">
        {words.line}
      </p>
      {words.note === null ? null : (
        <p className="text-sm text-text-primary">
          <span className="font-semibold">{t.closed.note} </span>
          <span dir="auto" className="break-words whitespace-pre-wrap">
            {words.note}
          </span>
        </p>
      )}
    </section>
  );
}
