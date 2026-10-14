"use client";

// The client side of a "mon compte" page (docs/mvp/17 §6): the frame, then the screen of the page.
import type { AccountPage } from "@/lib/member-paths";
import { AccountShell, type AccountContext } from "./AccountShell";
import { DataScreen } from "./DataScreen";
import { DetailsScreen } from "./DetailsScreen";
import { PreferencesScreen } from "./PreferencesScreen";
import { SessionsScreen } from "./SessionsScreen";

function screenOf(page: AccountPage, context: AccountContext) {
  switch (page) {
    case "accountDetails":
      return <DetailsScreen {...context} />;
    case "accountPreferences":
      return <PreferencesScreen {...context} />;
    case "accountSessions":
      return <SessionsScreen {...context} />;
    case "accountData":
      return <DataScreen {...context} />;
  }
}

export function AccountPageView({ page }: { page: AccountPage }) {
  return (
    <AccountShell page={page}>
      {(context) => screenOf(page, context)}
    </AccountShell>
  );
}
