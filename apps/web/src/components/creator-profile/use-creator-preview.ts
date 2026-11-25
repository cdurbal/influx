"use client";

// The state of "ce que voit une marque" (docs/mvp/07 RG104; 17 §5.2; jalons/l2g, commit 14), outside the
// component (CLAUDE.md §5): the answer of `GET /v1/me/creator-profile/preview` as it comes, and the bytes of
// the visuals the card shows, each one read once through the portfolio's route with the identifiers of
// the projection (a `data:` source built by the API, never an address). Nothing is decided here.
import type { CreatorPreviewResponse } from "@influx/contracts/creator-projection";
import type { PortfolioImageResponse } from "@influx/contracts/creator-portfolio";
import { useCallback, useEffect, useRef, useState } from "react";
import { readCreatorPreview } from "./creator-preview-api";
import { readPortfolioImage } from "./creator-portfolio-api";
import { PREVIEW_VISUALS_SHOWN } from "./creator-preview-view";

export type PreviewPhase = "loading" | "ready" | "unavailable" | "gone";

export type CreatorPreviewState = {
  phase: PreviewPhase;
  preview: CreatorPreviewResponse | null;
  images: Readonly<Record<string, PortfolioImageResponse>>;
  reload: () => void;
};

export function useCreatorPreview(options: {
  /** The session ended: the shell shows "signed out". */
  onSignedOut: () => void;
}): CreatorPreviewState {
  const [phase, setPhase] = useState<PreviewPhase>("loading");
  const [preview, setPreview] = useState<CreatorPreviewResponse | null>(null);
  const [images, setImages] = useState<
    Readonly<Record<string, PortfolioImageResponse>>
  >({});
  const asked = useRef<Set<string>>(new Set());
  const callbacks = useRef(options);
  useEffect(() => {
    callbacks.current = options;
  }, [options]);

  const load = useCallback(async (): Promise<void> => {
    setPhase("loading");
    const result = await readCreatorPreview();
    if (result.kind === "ok") {
      setPreview(result.data);
      setPhase("ready");
    } else if (result.kind === "unauthenticated") {
      callbacks.current.onSignedOut();
    } else {
      // A creator role without a storefront has nothing a brand could see: the page does not exist.
      setPhase(result.code === "not_found" ? "gone" : "unavailable");
    }
  }, []);

  useEffect(() => {
    // The read starts once, at the mount; its answer is the state of the page.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  // The bytes of the visuals of the card, once each, as they come into the answer.
  useEffect(() => {
    const shown = preview?.before.visuals.slice(0, PREVIEW_VISUALS_SHOWN) ?? [];
    for (const visual of shown) {
      if (asked.current.has(visual.id)) {
        continue;
      }
      asked.current.add(visual.id);
      void readPortfolioImage(visual.id).then((result) => {
        if (result.kind === "ok") {
          setImages((previous) => ({ ...previous, [visual.id]: result.data }));
        } else if (result.kind === "unauthenticated") {
          callbacks.current.onSignedOut();
        } else {
          // Asked again at the next reading of the answer, never in a loop.
          asked.current.delete(visual.id);
        }
      });
    }
  }, [preview]);

  return { phase, preview, images, reload: () => void load() };
}
