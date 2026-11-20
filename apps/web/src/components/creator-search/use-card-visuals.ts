"use client";

// The visuals of the cards of the brand's screens (docs/mvp/10 RG50; 17 §7.1; jalons/l3f, commits 10 and 11), read once
// each through the route of the visuals of a card with the alias and the identifier of the projection (a `data:`
// source built by the API, never an address). The first one on a card of a grid or a list, three on a profile. A
// visual that does not come is dropped from its card, never shown as loading for good (RG84: a card without an
// image is a card). Nothing is decided here.
import type { PortfolioImageResponse } from "@influx/contracts/creator-portfolio";
import type { CreatorSearchCard } from "@influx/contracts/creator-search";
import { useEffect, useMemo, useRef, useState } from "react";
import { readCreatorVisual } from "./creator-search-api";
import { cardVisualsOf, CARD_VISUALS_SHOWN } from "./creator-search-view";

export type CardVisuals = {
  images: Readonly<Record<string, PortfolioImageResponse>>;
  /** The identifiers of the visuals the API did not serve. */
  failed: ReadonlySet<string>;
};

/** A visual to read: the alias of its card and its opaque identifier (RG65). */
export type VisualRef = { alias: string; visualId: string };

export function useVisualImages(
  refs: readonly VisualRef[],
  onSignedOut: () => void,
): CardVisuals {
  const [images, setImages] = useState<
    Readonly<Record<string, PortfolioImageResponse>>
  >({});
  const [failed, setFailed] = useState<ReadonlySet<string>>(new Set());
  const asked = useRef<Set<string>>(new Set());
  const callbacks = useRef(onSignedOut);
  useEffect(() => {
    callbacks.current = onSignedOut;
  }, [onSignedOut]);

  useEffect(() => {
    for (const { alias, visualId } of refs) {
      if (asked.current.has(visualId)) {
        continue;
      }
      asked.current.add(visualId);
      void readCreatorVisual(alias, visualId).then((result) => {
        if (result.kind === "ok") {
          setImages((previous) => ({ ...previous, [visualId]: result.data }));
        } else if (result.kind === "unauthenticated") {
          callbacks.current();
        } else {
          setFailed((previous) => new Set(previous).add(visualId));
        }
      });
    }
  }, [refs]);

  return { images, failed };
}

/** The visuals of the cards of a page or a list: `shown` of each (the first one by default). */
export function useCardVisuals(
  cards: readonly Pick<CreatorSearchCard, "creator">[],
  onSignedOut: () => void,
  shown: number = CARD_VISUALS_SHOWN,
): CardVisuals {
  const refs = useMemo(
    () => cards.flatMap((card) => cardVisualsOf(card, shown)),
    [cards, shown],
  );
  return useVisualImages(refs, onSignedOut);
}
