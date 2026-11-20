"use client";

// The first visual of each card of M4 (docs/mvp/10 RG50; 17 §7.1; jalons/l3f, commit 10), read once each through
// the route of the visuals of a card with the alias and the identifier of the projection (a `data:` source built
// by the API, never an address). A visual that does not come is dropped from its card, never shown as loading for
// good (RG84: a card without an image is a card). Nothing is decided here.
import type { PortfolioImageResponse } from "@influx/contracts/creator-portfolio";
import type { CreatorSearchCard } from "@influx/contracts/creator-search";
import { useEffect, useRef, useState } from "react";
import { readCreatorVisual } from "./creator-search-api";
import { cardVisualsOf } from "./creator-search-view";

export type CardVisuals = {
  images: Readonly<Record<string, PortfolioImageResponse>>;
  /** The identifiers of the visuals the API did not serve. */
  failed: ReadonlySet<string>;
};

export function useCardVisuals(
  cards: readonly CreatorSearchCard[],
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
    for (const card of cards) {
      for (const { alias, visualId } of cardVisualsOf(card)) {
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
    }
  }, [cards]);

  return { images, failed };
}
