"use client";

// The identified creator search of an agent (docs/mvp/10 RG71 to RG73, RG76 to RG78, CA56, CA58, CA61; 17b §3.3, §4.9;
// jalons/l3g/modele.md §1, §4, §8; l3g-fiche invariants 4 to 7, 12, 13; L3G-12), on the one engine of the brand's
// search in its `agent_identified` mode: names, handles, exact figures, profiles not published labelled, the pair
// blocked told by its sentence. Opened from a campaign (`?campagne=`), the facets are drawn from its brief: the base
// proposes them and journals the proposal, then every search says which proposal it comes from, so that what is
// kept, removed and added is journaled (CA56); « Vider le pré-remplissage » keeps the link. The screen holds the
// facets applied, the sort, the page and the answer; the rules (which facet is open, the cap of pages, the blocks,
// the count) are the base's, and it never sends a size of page nor reads an amount (RG76, D78).
import type { CreatorSearchSort } from "@influx/contracts/creator-search";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { messages } from "@/messages/fr";
import { HELP_CLASSES, TITLE_CLASSES } from "./auth-classes";
import {
  readCampaignPrefill,
  searchIdentifiedCreators,
} from "./backoffice-api";
import { SMALL_SECONDARY_CLASSES } from "./bo-classes";
import { BoIdentifiedFrame } from "./BoIdentifiedFrame";
import { ErrorNotice } from "./ErrorNotice";
import { IdentifiedFacets } from "./IdentifiedFacets";
import { IdentifiedResults, type SearchLoad } from "./IdentifiedResults";
import {
  bodyOf,
  CAMPAIGN_CHOICE_HREF,
  campaignOfAddress,
  failureWords,
  filtersOfPrefill,
  FIRST_QUERY,
  prefillLineOf,
  withoutCriterion,
  type Criterion,
  type Filters,
  type SearchQuery,
} from "./identified-search-view";

const t = messages.identifiedSearch;

/** The campaign the search comes from, and the proposal the filters were drawn from (CA56). */
type Origin = { campaignId: string; title: string; prefillId: string };

/** Where the origin stands: no campaign, its brief being read, drawn, or refused (the search is then free). */
type OriginState =
  | { kind: "none" }
  | { kind: "reading" }
  | { kind: "drawn"; origin: Origin }
  | { kind: "unknown" }
  | { kind: "failed" };

/** The answer of one query: kept with the query it answers, so that another query reads as « loading » (use-ops-read). */
type Settled = {
  to: SearchQuery;
  load: Exclude<SearchLoad, { kind: "loading" }>;
};

/** The campaign of the address starts a search of its own: another campaign remounts the screen, nothing is carried over. */
export function IdentifiedSearchScreen() {
  const parameters = useSearchParams();
  const wanted = campaignOfAddress(parameters.get("campagne"));
  return <IdentifiedSearch key={wanted ?? "free"} wanted={wanted} />;
}

function IdentifiedSearch({ wanted }: { wanted: string | null }) {
  const router = useRouter();
  const [originState, setOriginState] = useState<OriginState>(
    wanted === null ? { kind: "none" } : { kind: "reading" },
  );
  const [query, setQuery] = useState<SearchQuery | null>(
    wanted === null ? FIRST_QUERY : null,
  );
  const [settled, setSettled] = useState<Settled | null>(null);
  // « Vider le pré-remplissage » was pressed: the link to the campaign stays, the facets are gone (J3).
  const [prefillCleared, setPrefillCleared] = useState(false);
  // A change the agent made asks for the focus on the count once its answer is drawn (J2, WCAG 2.4.3).
  const focusRequest = useRef(false);

  // The brief of the campaign of the address: read once, proposed filters become the first search.
  useEffect(() => {
    if (wanted === null) {
      return;
    }
    let active = true;
    void readCampaignPrefill(wanted).then((result) => {
      if (!active) {
        return;
      }
      if (result.kind === "unauthenticated") {
        router.replace("/");
        return;
      }
      if (result.kind === "ok") {
        const { prefillId, campaign, filters } = result.data;
        setOriginState({
          kind: "drawn",
          origin: {
            campaignId: campaign.id,
            title: campaign.title,
            prefillId,
          },
        });
        setQuery({
          ...FIRST_QUERY,
          filters: filtersOfPrefill(filters),
          campaignId: campaign.id,
          prefillId,
        });
        return;
      }
      setOriginState({
        kind: result.code === "not_found" ? "unknown" : "failed",
      });
      setQuery(FIRST_QUERY);
    });
    return () => {
      active = false;
    };
  }, [wanted, router]);

  // One search per query: the answer is dropped when the query changed meanwhile.
  useEffect(() => {
    if (query === null) {
      return;
    }
    let active = true;
    void searchIdentifiedCreators(bodyOf(query)).then((result) => {
      if (!active) {
        return;
      }
      if (result.kind === "unauthenticated") {
        router.replace("/");
        return;
      }
      setSettled({
        to: query,
        load:
          result.kind === "ok"
            ? { kind: "ok", response: result.data }
            : {
                kind: "error",
                text: failureWords(
                  result.code,
                  result.issues,
                  result.retryAfterSeconds,
                ),
              },
      });
    });
    return () => {
      active = false;
    };
  }, [query, router]);

  const load: SearchLoad =
    query === null || settled === null || settled.to !== query
      ? { kind: "loading" }
      : settled.load;
  const current = query ?? FIRST_QUERY;

  const run = (next: SearchQuery) => {
    focusRequest.current = true;
    setQuery(next);
  };
  const takeFocusRequest = useCallback(() => {
    const wanted = focusRequest.current;
    focusRequest.current = false;
    return wanted;
  }, []);
  const apply = (next: Partial<SearchQuery>) => run({ ...current, ...next });
  const applyFilters = (filters: Filters) => apply({ filters, page: 1 });
  const clearPrefill = () => {
    setPrefillCleared(true);
    run({ ...current, filters: {}, page: 1 });
  };

  return (
    <BoIdentifiedFrame>
      <h1 className={TITLE_CLASSES}>{t.title}</h1>
      <OriginLine
        state={originState}
        cleared={prefillCleared}
        onClear={clearPrefill}
      />
      <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-(--grid-bo-identified)">
        <IdentifiedFacets
          applied={current.filters}
          onApply={applyFilters}
          onReset={() => applyFilters({})}
        />
        <IdentifiedResults
          filters={current.filters}
          sort={current.sort}
          load={load}
          onRemove={(criterion: Criterion) =>
            applyFilters(withoutCriterion(current.filters, criterion))
          }
          onSort={(sort: CreatorSearchSort) => apply({ sort, page: 1 })}
          onPage={(page: number) => apply({ page })}
          onRetry={() => run({ ...current })}
          takeFocusRequest={takeFocusRequest}
        />
      </div>
    </BoIdentifiedFrame>
  );
}

/** The line under the title: the campaign the facets come from, or the words that say there is none (17b §3.3). */
function OriginLine({
  state,
  cleared,
  onClear,
}: {
  state: OriginState;
  cleared: boolean;
  onClear: () => void;
}) {
  const o = t.origin;
  if (state.kind === "reading") {
    return (
      <p role="status" className={HELP_CLASSES}>
        {o.loading}
      </p>
    );
  }
  if (state.kind === "drawn") {
    const line = prefillLineOf(state.origin.title, cleared);
    return (
      <div
        data-prefill-line
        className="flex flex-wrap items-center gap-3 text-sm text-text-primary"
      >
        <p>{line.text}</p>
        <button
          type="button"
          onClick={onClear}
          disabled={!line.canClear}
          className={SMALL_SECONDARY_CLASSES}
        >
          {o.clear}
        </button>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      {state.kind === "unknown" ? <ErrorNotice>{o.unknown}</ErrorNotice> : null}
      {state.kind === "failed" ? <ErrorNotice>{o.failed}</ErrorNotice> : null}
      <div className="flex flex-wrap items-center gap-3 text-sm text-text-primary">
        <p>{o.none}</p>
        <Link href={CAMPAIGN_CHOICE_HREF} className={SMALL_SECONDARY_CLASSES}>
          {o.choose}
        </Link>
      </div>
    </div>
  );
}
