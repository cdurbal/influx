import type { ReactNode } from "react";

/** Shared `t.rich()` tag: the lighter, secondary half of a two-tone section title. */
export const mutedTitleTags = {
  muted: (chunks: ReactNode) => (
    <span className="text-text-secondary">{chunks}</span>
  ),
};
