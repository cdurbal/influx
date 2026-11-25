"use client";

// The state of the brand profile as the shell holds it for the pages around the form (docs/mvp/17
// §2.3 "Bloc d'état du compte", §2.4; jalons/l2b, commit 13): the home and the column of the space
// write it. The mechanics are those of every member's summary (member/use-profile-summary.ts); this
// file gives the read: only the state, the date and the missing fields are kept (summaryOf), the form
// has its own hook.
import {
  useProfileSummary,
  type ProfileSummary,
  type SummaryState,
} from "@/components/member/use-profile-summary";
import { readBrandProfile } from "./brand-profile-api";
import { summaryOf, type BrandProfileSummary } from "./brand-profile-view";

export type BrandSummaryState = SummaryState<BrandProfileSummary>;
export type BrandSummary = ProfileSummary<BrandProfileSummary>;

async function readBrandSummary(): Promise<BrandProfileSummary | null> {
  const result = await readBrandProfile();
  return result.kind === "ok" ? summaryOf(result.data) : null;
}

/**
 * `enabled`: the member is a brand and the session is read. `readKey` changes at each page: the
 * profile is read again, the previous one stays on screen meanwhile (no flash of "loading").
 */
export function useBrandSummary(
  enabled: boolean,
  readKey: string,
): BrandSummary {
  return useProfileSummary(enabled, readKey, readBrandSummary);
}
