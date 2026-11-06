"use client";

// The state of the creator profile as the shell holds it for the home and the column of the space
// (docs/mvp/17 §2.3, §2.4; jalons/l2d, commit 15): the alias, the state, the score and what is still
// missing, nothing else (creatorSummaryOf). The mechanics are those of every member's summary
// (member/use-profile-summary.ts); the profile screen gives it each answer it gets.
import {
  useProfileSummary,
  type ProfileSummary,
  type SummaryState,
} from "@/components/member/use-profile-summary";
import { readCreatorProfile } from "./creator-profile-api";
import {
  creatorSummaryOf,
  type CreatorProfileSummary,
} from "./creator-profile-view";

export type CreatorSummaryState = SummaryState<CreatorProfileSummary>;
export type CreatorSummary = ProfileSummary<CreatorProfileSummary>;

async function readCreatorSummary(): Promise<CreatorProfileSummary | null> {
  const result = await readCreatorProfile();
  return result.kind === "ok" ? creatorSummaryOf(result.data) : null;
}

/** `enabled`: the member is a creator and the session is read; `readKey` changes at each page. */
export function useCreatorSummary(
  enabled: boolean,
  readKey: string,
): CreatorSummary {
  return useProfileSummary(enabled, readKey, readCreatorSummary);
}
