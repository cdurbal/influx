"use client";

// M4, « Créateurs » of a brand (docs/mvp/10 RG1, RG2, RG6, RG44, RG51 to RG64; 17 §4.4, §7.1; D38, D45, D48,
// D78; jalons/l3f, commit 10): the anonymous search. The criteria are the address's (a reload, the back button and
// the request for a selection read them); the form applies them together; the results are the cards of the
// platform, one source with the preview of a creator (CreatorCardView), each with its reasons « Proposé car »
// and its note of vigilance. Eight states, three of them specific (17 §4.4): below the threshold (the same for 0
// and for 4), closed (D38, the criteria and the request stay), the bucket full (the results shown stay
// readable); then the brand's profile not published, the cap of pages, an unusable campaign, loading, error. The
// list, its order, its count in a band and the pages are the API's: nothing here ranks, filters or counts, and no
// number, amount, tariff or action of introduction exists on the screen (CLAUDE.md §2, D45, D48, D78). Commit 11 adds
// to each card « Ajouter à ma sélection » and the way to its profile, and the panel « Ma sélection » (private, the
// active list of the address). The page of a brand: any other role finds no such page (18 T14.3, T14.4).
import type { CreatorSearchCard } from "@influx/contracts/creator-search";
import { notFound } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useId, useMemo, useState } from "react";
import { TEXT_LINK_CLASSES } from "@/components/auth/auth-classes";
import { useOnline } from "@/components/auth/use-online";
import { CreatorCardView } from "@/components/creator-profile/CreatorCardView";
import { cardOfProjection } from "@/components/creator-profile/creator-preview-view";
import { useMember } from "@/components/member/member-context";
import { Card } from "@/components/member/ui/Card";
import { Button } from "@/components/member/ui/Button";
import { Notice } from "@/components/member/ui/Notice";
import { PageHeader } from "@/components/member/ui/PageHeader";
import { buttonClasses } from "@/components/member/ui/button-classes";
import {
  MEMBER_FIELD_HELP_CLASSES,
  MEMBER_FIELD_LABEL_CLASSES,
  memberControlClasses,
} from "@/components/member/ui/field-classes";
import { CARD_TITLE } from "@/components/member/ui/heading-classes";
import { ErrorNotice } from "@/components/ui/ErrorNotice";
import { cn } from "@/components/ui/class-names";
import {
  CircleAlertIcon,
  CloseIcon,
  FilterIcon,
  InfoIcon,
} from "@/components/ui/icons";
import { Link, useRouter } from "@/i18n/navigation";
import { memberPageHref } from "@/lib/member-paths";
import { AddToSelectionButton } from "./AddToSelectionButton";
import {
  SEARCH_CAMPAIGN_CLASSES,
  SEARCH_COUNT_CELL_CLASSES,
  SEARCH_COUNT_CLASSES,
  SEARCH_CRITERIA_CLASSES,
  SEARCH_FILTERS_BUTTON_CLASSES,
  SEARCH_FILTERS_CLASSES,
  SEARCH_FOCUS_TARGET_CLASSES,
  SEARCH_INFO_TOGGLE_CLASSES,
  SEARCH_LABEL_ROW_CLASSES,
  SEARCH_LAYOUT_CLASSES,
  SEARCH_PAGE_CLASSES,
  SEARCH_PAGER_CLASSES,
  SEARCH_REASON_LIST_CLASSES,
  SEARCH_REASONS_CLASSES,
  SEARCH_RESULTS_CELL_CLASSES,
  SEARCH_RESULTS_CLASSES,
  SEARCH_SKELETON_CLASSES,
  SEARCH_SORT_CLASSES,
  SELECTION_PANEL_CELL_CLASSES,
  CARD_ACTIONS_CLASSES,
} from "./creator-search-classes";
import {
  CARD_VISUALS_SHOWN,
  SEARCH_SORTS,
  addressParamsOf,
  criteriaCountOf,
  criteriaOf,
  queryKeyOf,
  reasonTextsOf,
  vigilanceTextOf,
  waitOf,
  widenedQuery,
  wideningsOf,
  withoutCriterion,
  EMPTY_QUERY,
  type ResultsScreen,
  type SearchLabels,
  type SearchQuery,
  type SearchScreen,
} from "./creator-search-view";
import { SearchFiltersForm } from "./SearchFiltersForm";
import { SelectionPanel } from "./SelectionPanel";
import { ShortlistsLink } from "./ShortlistsLink";
import { profileHref, requestHref, type SearchPlace } from "./shortlists-view";
import { useCardVisuals } from "./use-card-visuals";
import { useCreatorSearch } from "./use-creator-search";
import { useResultsFocus } from "./use-results-focus";
import { useShortlists, type Selection } from "./use-shortlists";
import { useSearchLabels } from "./use-search-labels";
import {
  useOriginCampaigns,
  useSearchReferences,
  type OriginCampaign,
  type SourceState,
} from "./use-search-sources";

/** The six skeletons of a page being read (17 §4.4, « chargement »). */
const SKELETON_COUNT = 6;

/** The page of a brand; any other role finds a page that does not exist (18 T14.3, T14.4). */
export function CreatorSearchScreen({
  query,
  page,
  listId,
}: {
  query: SearchQuery;
  page: number;
  listId: string | null;
}) {
  const { me } = useMember();
  if (me.role !== "advertiser") {
    notFound();
  }
  return <CreatorSearchView query={query} page={page} listId={listId} />;
}

/** The permanent way to the request for a selection (RG61), carrying the criteria and the campaign (reprise). */
function RequestLink({
  place,
  variant,
}: {
  place: SearchPlace;
  variant: "primary" | "secondary";
}) {
  const t = useTranslations("creatorSearch");
  const locale = useLocale();
  return (
    <Link href={requestHref(locale, place)} className={buttonClasses(variant)}>
      {t("request.link")}
    </Link>
  );
}

function CreatorSearchView({
  query,
  page,
  listId,
}: {
  query: SearchQuery;
  page: number;
  listId: string | null;
}) {
  const t = useTranslations("creatorSearch");
  const tAccount = useTranslations("account");
  const locale = useLocale();
  const router = useRouter();
  const online = useOnline();
  const { signedOut } = useMember();
  const labels = useSearchLabels();
  const onSignedOut = () => signedOut(null);
  const { screen, retry } = useCreatorSearch({ query, page, onSignedOut });
  const selection = useShortlists({ preferredId: listId, onSignedOut });
  const place: SearchPlace = { query, page, listId };
  const references = useSearchReferences();
  const campaigns = useOriginCampaigns();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const panelId = useId();

  const shown = shownResultsOf(screen);
  const { countRef, startRef, expectFocusAt } = useResultsFocus({
    addressKey: `${queryKeyOf(query)}|${page}`,
    settled: screen.kind !== "loading",
  });

  const apply = (next: SearchQuery, nextPage = 1) => {
    if (filtersOpen) {
      // the opened block closes with this application: the focus must not fall on <body> (L3FU-2)
      expectFocusAt(`${queryKeyOf(next)}|${nextPage}`);
    }
    setFiltersOpen(false);
    router.replace(
      `${memberPageHref("advertiserCreators", locale)}${addressParamsOf(next, nextPage, listId)}`,
    );
  };
  /** The list the brand chose or made: the address carries it, the search itself is untouched. */
  const selectList = (id: string) => {
    router.replace(
      `${memberPageHref("advertiserCreators", locale)}${addressParamsOf(query, page, id)}`,
    );
  };
  const criteria = useMemo(
    () => criteriaOf(query.filters, labels),
    [query.filters, labels],
  );
  const closedBlock = filtersOpen ? "" : "max-lg:hidden";
  const filtersLabel = filtersOpen
    ? t("filters.close")
    : criteriaCountOf(query.filters) === 0
      ? t("filters.open")
      : t("filters.openCount", { count: criteriaCountOf(query.filters) });

  return (
    <div className={SEARCH_PAGE_CLASSES}>
      {online ? null : <Notice tone="warning">{tAccount("offline")}</Notice>}
      <PageHeader
        title={t("page.title")}
        actions={<RequestLink place={place} variant="secondary" />}
      />
      <ShortlistsLink />
      <p className="text-md text-text-secondary">{t("page.explain")}</p>
      <div className={SEARCH_LAYOUT_CLASSES}>
        <Button
          variant="secondary"
          className={SEARCH_FILTERS_BUTTON_CLASSES}
          aria-expanded={filtersOpen}
          aria-controls={panelId}
          onClick={() => setFiltersOpen((open) => !open)}
        >
          <FilterIcon aria-hidden="true" className="size-(--size-icon-md)" />
          {filtersLabel}
        </Button>
        <SortControl query={query} labels={labels} onChange={apply} />
        <CampaignControl
          query={query}
          campaigns={campaigns.state}
          labels={labels}
          className={closedBlock}
          onChange={apply}
        />
        <div id={panelId} className={cn(SEARCH_FILTERS_CLASSES, closedBlock)}>
          <SearchFiltersForm
            key={queryKeyOf(query)}
            filters={query.filters}
            references={references.state}
            labels={labels}
            onApply={(filters) => apply({ ...query, filters })}
            onClear={() => apply({ ...query, filters: {} })}
            onReload={references.reload}
          />
        </div>
        {shown === null ? null : (
          <p
            ref={countRef}
            tabIndex={-1}
            role="status"
            data-count-band={shown.countBand}
            className={cn(
              SEARCH_COUNT_CLASSES,
              SEARCH_COUNT_CELL_CLASSES,
              SEARCH_FOCUS_TARGET_CLASSES,
            )}
          >
            {t(`bands.${shown.countBand}`)}
          </p>
        )}
        {criteria.length === 0 ? null : (
          <div className={SEARCH_CRITERIA_CLASSES}>
            <p className={MEMBER_FIELD_LABEL_CLASSES}>{t("criteria.title")}</p>
            <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
              {criteria.map((criterion) => (
                <li key={criterion.id}>
                  <Button
                    variant="secondary"
                    data-criterion={criterion.id}
                    onClick={() => apply(withoutCriterion(query, criterion))}
                  >
                    {criterion.label}
                    <CloseIcon
                      aria-hidden="true"
                      className="size-(--size-icon-sm) shrink-0"
                    />
                    <span className="sr-only">
                      {t("criteria.remove", { label: criterion.label })}
                    </span>
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div
          ref={startRef}
          tabIndex={-1}
          data-results-start=""
          className={SEARCH_RESULTS_CELL_CLASSES}
        >
          <Body
            screen={screen}
            query={query}
            place={place}
            labels={labels}
            selection={selection}
            onApply={apply}
            onRetry={retry}
            onSignedOut={onSignedOut}
          />
        </div>
        <SelectionPanel
          selection={selection}
          place={place}
          onSelect={selectList}
          className={SELECTION_PANEL_CELL_CLASSES}
        />
      </div>
    </div>
  );
}

/** The results a screen shows: its own, or those a refusal leaves readable (17 §4.4, « plafond atteint »). */
function shownResultsOf(screen: SearchScreen): ResultsScreen | null {
  switch (screen.kind) {
    case "results":
      return screen;
    case "rate_limited":
    case "page_cap":
    case "failed":
      return screen.kept;
    default:
      return null;
  }
}

/** The campaign the search is linked to (RG37): a change is a new search; at the head of the opened block below lg. */
function CampaignControl({
  query,
  campaigns,
  labels,
  className,
  onChange,
}: {
  query: SearchQuery;
  campaigns: SourceState<OriginCampaign[]>;
  labels: SearchLabels;
  className: string;
  onChange: (query: SearchQuery) => void;
}) {
  const t = labels.text;
  const campaignId = useId();
  const options = campaigns.phase === "ready" ? campaigns.value : [];
  const current = query.campaignId;
  const known = current === null || options.some((item) => item.id === current);
  return (
    <div className={cn(SEARCH_CAMPAIGN_CLASSES, className)}>
      <label htmlFor={campaignId} className={MEMBER_FIELD_LABEL_CLASSES}>
        {t("campaign.label")}
      </label>
      <select
        id={campaignId}
        name="campaign"
        value={current ?? ""}
        onChange={(event) =>
          onChange({
            ...query,
            campaignId: event.target.value === "" ? null : event.target.value,
          })
        }
        className={memberControlClasses(false)}
      >
        <option value="">{t("campaign.none")}</option>
        {known || current === null ? null : (
          <option value={current}>{t("campaign.current")}</option>
        )}
        {options.map((item) => (
          <option key={item.id} value={item.id}>
            {item.title ?? t("campaign.untitled")}
          </option>
        ))}
      </select>
      {campaigns.phase === "failed" ? (
        <p className={MEMBER_FIELD_HELP_CLASSES}>{t("campaign.failed")}</p>
      ) : null}
    </div>
  );
}

/**
 * The sort (RG44), named on the screen. Its explanation (« Pertinence » is not a score) is behind a [i], a native
 * disclosure, and stays the description of the select (17 §4.4).
 */
function SortControl({
  query,
  labels,
  onChange,
}: {
  query: SearchQuery;
  labels: SearchLabels;
  onChange: (query: SearchQuery) => void;
}) {
  const t = labels.text;
  const sortId = useId();
  const sortHelpId = useId();
  return (
    <div className={SEARCH_SORT_CLASSES}>
      <div className={SEARCH_LABEL_ROW_CLASSES}>
        <label htmlFor={sortId} className={MEMBER_FIELD_LABEL_CLASSES}>
          {t("sort.label")}
        </label>
      </div>
      <details data-sort-explain="">
        <summary
          aria-label={t("sort.explainToggle")}
          className={SEARCH_INFO_TOGGLE_CLASSES}
        >
          <InfoIcon aria-hidden="true" className="size-(--size-icon-md)" />
        </summary>
        <p id={sortHelpId} className={MEMBER_FIELD_HELP_CLASSES}>
          {t("sort.explain")}
        </p>
      </details>
      <select
        id={sortId}
        name="sort"
        value={query.sort}
        aria-describedby={sortHelpId}
        onChange={(event) =>
          onChange({
            ...query,
            sort:
              SEARCH_SORTS.find((sort) => sort === event.target.value) ??
              EMPTY_QUERY.sort,
          })
        }
        className={memberControlClasses(false)}
      >
        {SEARCH_SORTS.map((sort) => (
          <option key={sort} value={sort}>
            {t(`sort.${sort}`)}
          </option>
        ))}
      </select>
    </div>
  );
}

function Body({
  screen,
  query,
  place,
  labels,
  selection,
  onApply,
  onRetry,
  onSignedOut,
}: {
  screen: SearchScreen;
  query: SearchQuery;
  place: SearchPlace;
  labels: SearchLabels;
  selection: Selection;
  onApply: (query: SearchQuery, page?: number) => void;
  onRetry: () => void;
  onSignedOut: () => void;
}) {
  const t = useTranslations("creatorSearch");
  const tBrand = useTranslations("brandProfile");
  const locale = useLocale();
  switch (screen.kind) {
    case "loading":
      return (
        <div className="flex flex-col gap-4">
          <p role="status" className="text-sm text-text-secondary">
            {t("results.loading")}
          </p>
          <div aria-hidden="true" className={SEARCH_RESULTS_CLASSES}>
            {Array.from({ length: SKELETON_COUNT }, (_, index) => (
              <div key={index} className={SEARCH_SKELETON_CLASSES} />
            ))}
          </div>
        </div>
      );
    case "closed":
      return (
        <Card>
          <h2 className={CARD_TITLE}>{t("closed.title")}</h2>
          <p data-state="closed" className="text-md text-text-secondary">
            {t("closed.notice")}
          </p>
          <RequestLink place={place} variant="primary" />
        </Card>
      );
    case "brand_not_published":
      return (
        <Card>
          <p
            data-state="brand_not_published"
            className="text-md text-text-secondary"
          >
            {tBrand("search.blockedUntilPublished")}
          </p>
          <Link
            href={memberPageHref("accountProfile", locale)}
            className={TEXT_LINK_CLASSES}
          >
            {t("notPublished.action")}
          </Link>
        </Card>
      );
    case "too_narrow": {
      const widenings = wideningsOf(query.filters);
      return (
        <Card>
          <h2 data-state="too_narrow" className={CARD_TITLE}>
            {t("tooNarrow.title")}
          </h2>
          <p className="text-md text-text-secondary">{t("tooNarrow.text")}</p>
          {widenings.length === 0 ? null : (
            <div className="flex flex-col gap-2">
              <p className={MEMBER_FIELD_LABEL_CLASSES}>
                {t("tooNarrow.widen")}
              </p>
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {widenings.map((widening) => (
                  <li key={widening.facet}>
                    <Button
                      variant="secondary"
                      data-widen={widening.facet}
                      onClick={() => onApply(widenedQuery(query, widening))}
                    >
                      {widening.mode === "loosen"
                        ? t("tooNarrow.loosen")
                        : t("tooNarrow.remove", {
                            facet: t(`facets.${widening.facet}`),
                          })}
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <RequestLink place={place} variant="primary" />
        </Card>
      );
    }
    case "results":
      return (
        <Results
          screen={screen}
          query={query}
          place={place}
          labels={labels}
          selection={selection}
          onApply={onApply}
          onSignedOut={onSignedOut}
        />
      );
    case "rate_limited": {
      const wait = waitOf(screen.retryAfterSeconds);
      return (
        <div className="flex flex-col gap-4">
          <Notice tone="warning">
            <p data-state="rate_limited">{t("rateLimited.text")}</p>
            {wait === null ? null : (
              <p>
                {wait.unit === "minutes"
                  ? t("rateLimited.waitMinutes", { count: wait.count })
                  : t("rateLimited.waitHours", { count: wait.count })}
              </p>
            )}
            {screen.kept === null ? null : <p>{t("rateLimited.kept")}</p>}
          </Notice>
          <RequestLink place={place} variant="primary" />
          {screen.kept === null ? null : (
            <Results
              screen={screen.kept}
              query={query}
              place={place}
              labels={labels}
              selection={selection}
              onApply={onApply}
              onSignedOut={onSignedOut}
              frozen
            />
          )}
        </div>
      );
    }
    case "page_cap":
      return (
        <div className="flex flex-col gap-4">
          <Notice tone="info">
            <span data-state="page_cap">{t("pageCap.text")}</span>
          </Notice>
          <Button variant="secondary" onClick={() => onApply(query, 1)}>
            {t("results.backToFirst")}
          </Button>
        </div>
      );
    case "forbidden":
      return (
        <div className="flex flex-col gap-4">
          <ErrorNotice>
            <span data-state="forbidden">{t("forbidden.text")}</span>
          </ErrorNotice>
          <Button
            variant="secondary"
            onClick={() => onApply({ ...query, campaignId: null })}
          >
            {t("forbidden.action")}
          </Button>
        </div>
      );
    case "failed":
      return (
        <div className="flex flex-col gap-4">
          <ErrorNotice>
            <span data-state="failed">{t("failed.text")}</span>
          </ErrorNotice>
          <Button variant="secondary" onClick={onRetry}>
            {t("failed.retry")}
          </Button>
          {screen.kept === null ? null : (
            <Results
              screen={screen.kept}
              query={query}
              place={place}
              labels={labels}
              selection={selection}
              onApply={onApply}
              onSignedOut={onSignedOut}
              frozen
            />
          )}
        </div>
      );
  }
}

/**
 * The cards of a page, the way to the pages around it, and the cap said when it hides cards (RG63: pages
 * explicit, never infinite). `frozen`: the results left readable under a refusal, their pager off.
 */
function Results({
  screen,
  query,
  place,
  labels,
  selection,
  onApply,
  onSignedOut,
  frozen = false,
}: {
  screen: ResultsScreen;
  query: SearchQuery;
  place: SearchPlace;
  labels: SearchLabels;
  selection: Selection;
  onApply: (query: SearchQuery, page?: number) => void;
  onSignedOut: () => void;
  frozen?: boolean;
}) {
  const t = useTranslations("creatorSearch");
  const visuals = useCardVisuals(screen.cards, onSignedOut);
  return (
    <>
      {screen.cards.length === 0 ? (
        <Card>
          <p
            data-state="end_of_results"
            className="text-md text-text-secondary"
          >
            {t("results.endOfResults")}
          </p>
          <Button variant="secondary" onClick={() => onApply(query, 1)}>
            {t("results.backToFirst")}
          </Button>
        </Card>
      ) : (
        <ul aria-label={t("results.title")} className={SEARCH_RESULTS_CLASSES}>
          {screen.cards.map((card) => (
            <li key={card.creator.alias} data-search-card={card.creator.alias}>
              <ResultCard
                card={card}
                labels={labels}
                visuals={visuals}
                selection={selection}
                place={place}
              />
            </li>
          ))}
        </ul>
      )}
      {screen.capReached ? (
        <Notice tone="info">{t("results.capReached")}</Notice>
      ) : null}
      {frozen ||
      (screen.previousPage === null && screen.nextPage === null) ? null : (
        <nav aria-label={t("results.pager")} className={SEARCH_PAGER_CLASSES}>
          {screen.previousPage === null ? (
            <span />
          ) : (
            <Button
              variant="secondary"
              data-page="previous"
              onClick={() => onApply(query, screen.previousPage ?? 1)}
            >
              {t("results.previous")}
            </Button>
          )}
          <span className="text-sm text-text-secondary">
            {t("results.page", { page: screen.page })}
          </span>
          {screen.nextPage === null ? (
            <span />
          ) : (
            <Button
              variant="secondary"
              data-page="next"
              onClick={() => onApply(query, screen.nextPage ?? 1)}
            >
              {t("results.next")}
            </Button>
          )}
        </nav>
      )}
    </>
  );
}

/** One card of the grid: the card of the preview, then « Proposé car » and the note of vigilance (17 §7.1). */
function ResultCard({
  card,
  labels,
  visuals,
  selection,
  place,
}: {
  card: CreatorSearchCard;
  labels: SearchLabels;
  visuals: ReturnType<typeof useCardVisuals>;
  selection: Selection;
  place: SearchPlace;
}) {
  const t = useTranslations("creatorSearch");
  const locale = useLocale();
  const view = useMemo(() => {
    const drawn = cardOfProjection(
      card.creator,
      labels.card,
      CARD_VISUALS_SHOWN,
    );
    return {
      ...drawn,
      visuals: drawn.visuals.filter((visual) => !visuals.failed.has(visual.id)),
    };
  }, [card, labels, visuals.failed]);
  const reasons = reasonTextsOf(card, labels);
  const vigilance = vigilanceTextOf(card, labels);
  return (
    <CreatorCardView
      card={view}
      images={visuals.images}
      noVisualText={null}
      footer={
        <>
          <div data-reasons="" className={SEARCH_REASONS_CLASSES}>
            <h3 className={CARD_TITLE}>{t("reasons.title")}</h3>
            <ul className={SEARCH_REASON_LIST_CLASSES}>
              {reasons.map((text, index) => (
                <li key={index}>{text}</li>
              ))}
            </ul>
            {vigilance === null ? null : (
              <p
                data-vigilance={card.vigilance}
                className="flex items-start gap-2 text-sm"
              >
                <CircleAlertIcon
                  aria-hidden="true"
                  className="size-(--size-icon-md) shrink-0 text-feedback-warning-icon"
                />
                <span>{t("reasons.vigilance", { text: vigilance })}</span>
              </p>
            )}
          </div>
          <div className={CARD_ACTIONS_CLASSES}>
            <AddToSelectionButton
              selection={selection}
              alias={card.creator.alias}
            />
            <Link
              href={profileHref(card.creator.alias, locale, place)}
              data-open-profile={card.creator.alias}
              className={TEXT_LINK_CLASSES}
            >
              {t("profile.open")}
              <span className="sr-only">
                {" "}
                {labels.card.text("alias.name", { alias: card.creator.alias })}
              </span>
            </Link>
          </div>
        </>
      }
    />
  );
}
