// Queue 2, « profils créateur à valider », as a list, in words (docs/mvp/07 RG4 to RG10, RG93; 15 RG27 C5,
// RG33; 17b §2.7 line 2; jalons/l2g/modele.md §6; L2G-15). Pure functions, outside the components: the own
// filters of the queue, the words of a line (networks, badges, modified fields, alerts). No rule is decided
// here (apps/api says what is overdue, who holds what and which entries the caller may see); the list shows
// an alias, a country, network codes, a score and the badges in force, never a handle, a link, a figure or a
// text of the creator (07 RG93: the decision screen holds them, behind a logged opening).
import { REVIEW_ENTRY_KINDS } from "@influx/contracts/backoffice-queues";
import type { CreatorEntryRow } from "@influx/contracts/creator-queues";
import { messages } from "@/messages/fr";
import type { OwnFilter } from "./queue-view-model";
import { levelWords, networkWords } from "./verification-queue-view";
import { countryName, countryOptions } from "./view-model";

const t = messages.creatorQueue;

/** The address of the screen of the queue, and of one of its entries (`${LIST}/${id}`). */
export const CREATOR_REVIEW_LIST = "/files/profils-createur";

/** The networks the list can be filtered by: the ones the platform names. */
const NETWORK_CODES = Object.keys(messages.verificationQueue.networks);

/** The own filters of the queue, after the common ones (17b §2.7 line 2, and the origin of 15 RG33). */
export function creatorOwnFilters(): readonly OwnFilter[] {
  return [
    {
      key: "kind",
      label: messages.queueList.kind,
      options: REVIEW_ENTRY_KINDS.map((value) => ({
        value,
        label: messages.queueList.kinds[value],
      })),
    },
    {
      key: "country",
      label: messages.queueList.country,
      options: countryOptions().map((country) => ({
        value: country.code,
        label: country.name,
      })),
    },
    {
      key: "network",
      label: t.filters.network,
      options: NETWORK_CODES.map((code) => ({
        value: code,
        label: networkWords(code),
      })),
    },
    {
      key: "badge",
      label: t.filters.badge,
      options: [
        { value: "with", label: t.filters.badgeOptions.with },
        { value: "without", label: t.filters.badgeOptions.without },
      ],
    },
  ];
}

/** The networks declared, the main one first, in words. */
export function networksWords(row: Pick<CreatorEntryRow, "networks">): string {
  return row.networks.length === 0
    ? t.none
    : row.networks.map((code) => networkWords(code)).join(", ");
}

/** The badges in force: the level and the network, never a figure. */
export function badgesWords(row: Pick<CreatorEntryRow, "badges">): string {
  return row.badges.length === 0
    ? t.none
    : row.badges
        .map((badge) =>
          t.badgeOf(levelWords(badge.level), networkWords(badge.networkCode)),
        )
        .join(", ");
}

/** The fields a revision changes, or the whole profile for a first submission. */
export function modifiedWords(
  row: Pick<CreatorEntryRow, "modifiedFields">,
): string {
  return row.modifiedFields.length === 0
    ? t.wholeProfile
    : row.modifiedFields.map((field) => t.fields[field]).join(", ");
}

/** The line under a row: its alerts in words, or nothing (07 RG93: informative, never a refusal). */
export function alertNote(row: Pick<CreatorEntryRow, "alerts">): string | null {
  return row.alerts.length === 0
    ? null
    : messages.queueList.alertLine(
        row.alerts.map((code) => t.alerts[code]).join(" · "),
      );
}

/** The country of a row, in words. */
export function creatorCountry(
  row: Pick<CreatorEntryRow, "countryCode">,
): string {
  return countryName(row.countryCode);
}
