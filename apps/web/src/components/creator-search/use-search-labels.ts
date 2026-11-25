"use client";

// The words of M4 and of what follows it (docs/mvp/04 R8: the labels come from the translation files, never from
// the database; jalons/l3f, commit 10): the words of the card are `creatorProfile`'s (one source with the preview
// of a creator, whose lists of topics, networks and formats are `brandProfile`'s), the words of the screen
// `creatorSearch`'s. A code with no label shows as itself. No logic lives here: the view decides what is said.
import { useLocale, useTranslations } from "next-intl";
import { useMemo } from "react";
import { previewLabelsOf } from "@/components/creator-profile/creator-preview-labels";
import type { SearchLabels } from "./creator-search-view";

export function useSearchLabels(): SearchLabels {
  const t = useTranslations("creatorSearch");
  const tCard = useTranslations("creatorProfile");
  const tBrand = useTranslations("brandProfile");
  const locale = useLocale();
  return useMemo(
    () => ({
      card: previewLabelsOf(tCard, tBrand, locale),
      text: (key, values) => t(key as Parameters<typeof t>[0], values),
    }),
    [t, tCard, tBrand, locale],
  );
}
