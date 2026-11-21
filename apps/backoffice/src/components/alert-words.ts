// An alert in words and the screen it leads to (docs/mvp/05 RG104, CA62; 15 §F RG63 to RG68, AL22, AL23, AL65;
// L3G-13): shared by the home and the settings of the search, so that an alert reads the same everywhere. Pure
// functions. The cause says why (never the colour alone, RG66); the count is the one apps/api derived.
import type { Alert } from "@influx/contracts/backoffice-actions";
import { messages } from "@/messages/fr";
import { SEARCH_SETTINGS_HREF } from "./search-settings-view";
import { TEAM_SELECTION_LIST } from "./team-selection-view";
import { formatDateTime } from "./view-model";

/** « Alerte AL65 — … (depuis le …) »; a cause the screen has no words for says its code. */
export function alertText(alert: Alert): string {
  const t = messages.alert;
  const destination =
    alert.destination === null ? "" : messages.destinations[alert.destination];
  const words = t.cause[alert.cause];
  return t.line(
    alert.code,
    words === undefined
      ? alert.cause
      : words(
          destination,
          alert.count,
          alert.setting === null
            ? undefined
            : messages.syncSetting[alert.setting],
        ),
    alert.since === null ? null : formatDateTime(alert.since),
  );
}

/** The screen an alert of queue 9 or of the search leads to; null for the others. */
export function alertLink(
  alert: Pick<Alert, "code">,
): { href: string; label: string } | null {
  switch (alert.code) {
    case "AL23":
      return {
        href: TEAM_SELECTION_LIST,
        label: messages.alert.openTeamSelection,
      };
    case "AL22":
    case "AL65":
      return {
        href: SEARCH_SETTINGS_HREF,
        label: messages.alert.openSearchSettings,
      };
    default:
      return null;
  }
}
