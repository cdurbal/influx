"use client";

// What the form of M4 draws its lists from (docs/mvp/10 RG11, RG37; 17 §4.4; jalons/l3f, commit 10), read once
// at the mount: the codes still active of the reference lists (the brand profile's `references`, the labels being
// the front's, 04 R8) and the campaigns a search may be linked to (the brand's own, out of draft and not
// rejected). Neither read ever blocks the search: a list that does not load leaves its control without choices
// and says so. Nothing is decided here: the base refuses a closed facet or a campaign that is not admitted.
import type { BrandProfileReferences } from "@influx/contracts/brand-profile";
import { CREATOR_SEARCH_ORIGIN_CAMPAIGN_STATUSES } from "@influx/contracts/creator-search";
import { useCallback, useEffect, useState } from "react";
import { readBrandProfile } from "@/components/brand-profile/brand-profile-api";
import { readCampaignList } from "@/components/campaign/campaign-api";

export type SourceState<Value> =
  { phase: "loading" } | { phase: "ready"; value: Value } | { phase: "failed" };

/** One campaign a search may be linked to: its opaque identifier, its title. */
export type OriginCampaign = {
  id: string;
  title: string | null;
};

function useSource<Value>(read: () => Promise<Value | null>): {
  state: SourceState<Value>;
  reload: () => void;
} {
  const [state, setState] = useState<SourceState<Value>>({ phase: "loading" });
  const load = useCallback(async () => {
    const value = await read();
    setState(value === null ? { phase: "failed" } : { phase: "ready", value });
  }, [read]);
  useEffect(() => {
    // The read starts once, at the mount; its answer is the state of the control.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);
  return {
    state,
    reload: () => {
      setState({ phase: "loading" });
      void load();
    },
  };
}

async function readReferences(): Promise<BrandProfileReferences | null> {
  const result = await readBrandProfile();
  return result.kind === "ok" ? result.data.references : null;
}

async function readOriginCampaigns(): Promise<OriginCampaign[] | null> {
  const result = await readCampaignList();
  if (result.kind !== "ok") {
    return null;
  }
  const admitted: readonly string[] = CREATOR_SEARCH_ORIGIN_CAMPAIGN_STATUSES;
  return result.data.campaigns
    .filter((campaign) => admitted.includes(campaign.status))
    .map((campaign) => ({ id: campaign.id, title: campaign.title }));
}

export function useSearchReferences() {
  return useSource(readReferences);
}

export function useOriginCampaigns() {
  return useSource(readOriginCampaigns);
}
