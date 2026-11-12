// Queue 3, « Visuels de portfolio à modérer », as a list, in words (docs/mvp/07 RG77 to RG85, RG93; 15 RG27 C5,
// RG33; 17b §2.7 line 3; jalons/l2g/modele.md §2, §6; L2G-16). Pure functions, outside the components: the own
// filters of the queue and the words of a line (the kind, the date of the deposit, the visuals of the profile).
// No rule is decided here (apps/api says what is overdue, who holds what and which entries the caller may see);
// the list shows an alias, the kind, a date and a count, NEVER a thumbnail (D82 (7)), a caption or a handle.
import {
  PORTFOLIO_ENTRY_KINDS,
  type PortfolioEntryRow,
} from "@influx/contracts/creator-queues";
import { messages } from "@/messages/fr";
import type { OwnFilter } from "./queue-view-model";
import { formatDate } from "./view-model";

const t = messages.portfolioQueue;

/** The address of the screen of the queue, and of one of its entries (`${LIST}/${id}`). */
export const PORTFOLIO_REVIEW_LIST = "/files/visuels";

/**
 * The own filters of the queue (17b §2.7 line 3): the profile, which no list offers (an agent comes to it from
 * the alias of a row, or from the record of the account), and the kind of the entry.
 */
export function portfolioOwnFilters(): readonly OwnFilter[] {
  return [
    {
      key: "account",
      label: t.filters.account,
      options: [],
      byIdentifier: { chipValue: t.filters.accountChip },
    },
    {
      key: "kind",
      label: t.filters.kind,
      options: PORTFOLIO_ENTRY_KINDS.map((value) => ({
        value,
        label: kindWords(value),
      })),
    },
  ];
}

/** « Premier dépôt » or « Remplacement » (07 RG81). */
export function kindWords(kind: string): string {
  return t.kinds[kind] ?? kind;
}

/** The date of the deposit, in the zone of the agent (15 RG34: dates by days, never an instant alone). */
export function depositedWords(
  row: Pick<PortfolioEntryRow, "createdAt">,
): string {
  return formatDate(row.createdAt);
}

/** The visuals of the profile that count as deposited (07 RG4, RG88): a count, in words. */
export function visualCountWords(
  row: Pick<PortfolioEntryRow, "visualCount">,
): string {
  return t.visualCount(row.visualCount);
}

/** The address of the list narrowed to one profile: the alias of a row leads to it. */
export function profileFilterHref(accountId: string): string {
  return `${PORTFOLIO_REVIEW_LIST}?account=${accountId}`;
}
