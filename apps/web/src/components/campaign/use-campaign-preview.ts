"use client";

// The state of "what a creator sees" (docs/mvp/09 RG102, CA68; jalons/l3b, commit 11), outside the component
// (CLAUDE.md §5): the answer of `GET /v1/me/campaigns/:id/creator-view` as it comes, read once at the mount,
// and the logo of the brand, read once through the profile's own route when the answer says there is one
// (the one other route this page calls, EC-L3B-08-1: the answer carries a flag, never the image). Nothing is
// decided here, nothing is rebuilt from the draft.
import type { BrandLogo } from "@influx/contracts/brand-profile";
import type { CampaignCreatorViewResponse } from "@influx/contracts/campaign-creator-view";
import { useCallback, useEffect, useRef, useState } from "react";
import { readBrandLogo } from "@/components/brand-profile/brand-profile-api";
import { readCampaignCreatorView } from "./campaign-api";

export type PreviewPhase = "loading" | "ready" | "unavailable" | "gone";

export type CampaignPreviewState = {
  phase: PreviewPhase;
  preview: CampaignCreatorViewResponse | null;
  /** The logo in force, once read; null while it loads, when there is none, and when it could not be read. */
  logo: BrandLogo | null;
  reload: () => void;
};

export function useCampaignPreview(
  id: string,
  options: {
    /** The session ended: the shell shows "signed out". */
    onSignedOut: () => void;
  },
): CampaignPreviewState {
  const [phase, setPhase] = useState<PreviewPhase>("loading");
  const [preview, setPreview] = useState<CampaignCreatorViewResponse | null>(
    null,
  );
  const [logo, setLogo] = useState<BrandLogo | null>(null);
  const logoAsked = useRef(false);
  const callbacks = useRef(options);
  useEffect(() => {
    callbacks.current = options;
  }, [options]);

  const load = useCallback(async (): Promise<void> => {
    setPhase("loading");
    const result = await readCampaignCreatorView(id);
    if (result.kind === "ok") {
      setPreview(result.data);
      setPhase("ready");
    } else if (result.kind === "unauthenticated") {
      callbacks.current.onSignedOut();
    } else {
      // Another brand's campaign and an identifier that is nobody's answer the same (T14): no such page.
      setPhase(
        result.code === "not_found" || result.code === "validation_failed"
          ? "gone"
          : "unavailable",
      );
    }
  }, [id]);

  useEffect(() => {
    // The read starts once, at the mount; its answer is the state of the page.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const hasLogo = preview?.brand?.hasLogo === true;
  useEffect(() => {
    if (!hasLogo || logoAsked.current) {
      return;
    }
    logoAsked.current = true;
    void readBrandLogo().then((result) => {
      if (result.kind === "ok") {
        setLogo(result.data.logo);
      } else if (result.kind === "unauthenticated") {
        callbacks.current.onSignedOut();
      } else {
        // The brand's name stands without its image; asked again at the next reading, never in a loop.
        logoAsked.current = false;
      }
    });
  }, [hasLogo]);

  return { phase, preview, logo, reload: () => void load() };
}
