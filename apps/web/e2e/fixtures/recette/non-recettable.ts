// The states of the mockups no loader can create today (docs/mvp/22-refonte-ux-ui/05 §4, 06b §5;
// RU-21, RU-22, RU-24, RUA-04). Each entry names the state, the datum or the route that is missing,
// and the decision that lifts it. A state leaves this list when its decision is taken and the screen
// that needs it is delivered: its loader is then added to `support/recette.ts`, never a table written
// by hand. The comparison (N1 to N3) skips these states; the survey still captures the mockup.
import type { StateKey } from "./states";

export type NonRecettable = {
  id: string;
  /** The states of the mockups that cannot be created, as `proto-<name>.html#<state>`. */
  states: readonly StateKey[];
  /** What the state shows that no route, table or helper serves today. */
  missing: string;
  /** The decision that lifts it, or the jalon that delivers the datum. */
  decision: string;
};

export const NON_RECETTABLE: readonly NonRecettable[] = [
  {
    id: "sync-failures-list",
    states: [
      "proto-bo-admin.html#synchro",
      "proto-bo-admin.html#synchro-normaux",
    ],
    missing:
      "E21: the list of failed synchronisations (account name, destination, cause), the filter by cause, the oldest one and the total of normal cases are not served (06b §5, E21: one row per account, without a name)",
    decision:
      "RU-21, option B: a dedicated read, in the additive-reads jalon (RUD)",
  },
  {
    id: "internal-account-deactivation",
    states: ["proto-bo-admin.html#desactiver"],
    missing:
      "E21.5: no route deactivates or transfers an internal account (06b §5, E21b)",
    decision:
      "RU-22: the route is specified and coded, or the gesture is delivered later (gap to grant)",
  },
  {
    id: "brand-public-page",
    states: [
      "proto-bo-decision.html#publie",
      "proto-marque.html#createur",
      "proto-marque.html#soumise",
    ],
    missing:
      "E05b and E05: no route reads the public page of a brand or its submitted version (06b §5, E05 and E05b rows)",
    decision:
      "RU-24: route under a visible campaign, internal read-only previews (E05b-Q1, E05-Q05)",
  },
  {
    id: "messaging-lot-4",
    states: [
      "proto-bo-mobile.html#convs",
      "proto-bo-mobile.html#conv",
      "proto-bo-recherche.html#lot4",
      "proto-campagnes-createur.html#fiche-lot4",
    ],
    missing:
      "the introduction, the conversation of three and the applications of the creator belong to the Lot 4: no table, no route",
    decision:
      "Lot 4 (D45, D47): the states are recorded after its delivery, not before",
  },
  {
    id: "selection-joined-to-request",
    states: [
      "proto-selections.html#cible-equipe",
      "proto-selections.html#demande",
      "proto-selections.html#demande-envoyee",
    ],
    missing:
      "E09: a request does not carry its selection (`selectionRequestBodySchema` has no `shortlistId`), and the team's selections do not show it (06b §5, E09 rows; RG61.1 to RG61.6 specified, never coded)",
    decision:
      "RU-22 (E09-Q1): the joint selection is coded as a remainder of L3G before E09.3, or E09.3 ships without the join",
  },
];
