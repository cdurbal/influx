// The session of the member, read by the shell and handed to the pages (docs/mvp/02 §21.5 point 1):
// a page never reads GET /v1/me itself (G9), it calls useMember(). Only rendered under
// MemberShell, which provides it once the account is read and the terms are settled.
import type { MeResponse } from "@influx/contracts/account";
import { createContext, useContext } from "react";
import type { BrandSummary } from "@/components/brand-profile/use-brand-summary";

export type MemberContextValue = {
  me: MeResponse;
  /** Reads the account again (after a change of address, a new language, the terms accepted…). */
  refresh: () => Promise<void>;
  /** Closes the session, then shows "signed out" (17 §2.3: never in a hidden menu). */
  signOut: () => Promise<void>;
  /** Ends the page on "signed out", with the sentence that says why (null: the member chose to). */
  signedOut: (message: string | null) => void;
  /** Ends the page on "your account is deleted" (D72): no navigation, the session is closed. */
  accountDeleted: () => void;
  /**
   * The state of a brand's profile (17 §2.3, §2.4), read by the shell for the column and the home;
   * `none` for a creator. The profile screen gives it each answer it gets (`adopt`).
   */
  brandProfile: BrandSummary;
};

export const MemberContext = createContext<MemberContextValue | null>(null);

export function useMember(): MemberContextValue {
  const value = useContext(MemberContext);
  if (value === null) {
    throw new Error("useMember() is called outside MemberShell");
  }
  return value;
}
