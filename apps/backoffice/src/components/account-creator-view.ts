// What blocks 2 to 4 of the record of a creator show, out of the answer of apps/api (docs/mvp/07 RG71, RG4,
// RG88; 17b §3.6; jalons/l2g/modele.md §1 point 13; L2G-17): one row per network line with its exact figures,
// their date and their source, and the portfolio as two counts. Pure functions, outside the components. No
// rule is decided here: apps/api says what the lines hold, which one waits for a decision and how many visuals
// count; this module only words. A figure the creator never gave is « non renseigné », never a zero and never a
// band (10 RG71). The words of a network and of a percentage are those of the queue screens.
import type { AccountCreator } from "@influx/contracts/backoffice-accounts";
import { messages } from "@/messages/fr";
import { basisPointsWords } from "./creator-review-view";
import { networkWords } from "./verification-queue-view";
import { formatDate } from "./view-model";

const t = messages.accountCreator;
const unset = messages.queueReview.unset;
const COUNT = new Intl.NumberFormat("fr-FR");

export type NetworkRowView = {
  id: string;
  /** The network in words. */
  network: string;
  /** Written, never by colour: « Réseau principal », « Réseau ajouté, en attente de validation. ». */
  notes: string[];
  followers: string;
  posts: string;
  comments: string;
  engagement: string;
  measuredAt: string;
  source: string;
};

function figure(value: number | null): string {
  return value === null ? unset : COUNT.format(value);
}

/** The lines of block 2, the main one first as the server sends them. */
export function networkRows(
  networks: AccountCreator["networks"],
): NetworkRowView[] {
  return networks.map((line) => ({
    id: line.id,
    network: networkWords(line.networkCode),
    notes: [
      ...(line.isPrimary ? [t.primary] : []),
      ...(line.awaitingValidation ? [t.unlisted] : []),
    ],
    followers: figure(line.followers),
    posts: figure(line.postsLast30Days),
    comments: figure(line.avgComments),
    engagement:
      line.engagementRateBp === null
        ? unset
        : t.engagement(basisPointsWords(line.engagementRateBp)),
    measuredAt: line.measuredAt === null ? unset : formatDate(line.measuredAt),
    source: t.sources[line.source] ?? line.source,
  }));
}

/** Block 4: « 12 visuels déposés · 2 en attente de modération », or that none was deposited. */
export function portfolioWords(portfolio: AccountCreator["portfolio"]): string {
  return portfolio.deposited === 0 && portfolio.pending === 0
    ? t.portfolioNone
    : t.portfolioLine(
        t.portfolioCount(portfolio.deposited),
        t.portfolioPending(portfolio.pending),
      );
}
