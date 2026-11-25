// What each state of the 23 mockups starts from (docs/mvp/22-refonte-ux-ui/05 §1 and §4; RUA-04). A
// state is creatable when the loaders it names can write the data it starts from; the gesture that
// reaches it (a step of a form, a confirmation, a delayed or refused call) belongs to the spec of the
// screen. The 13 states no loader can create are in `non-recettable.ts`, not here: the unit test
// (tests/recette-data.test.ts) checks that the two lists together hold exactly the 147 states of
// `e2e/support/visual/mockups.ts`, each once.
import type { LoaderId } from "./loaders";

/** `proto-<name>.html#<state>`: a state of a mockup. */
export type StateKey = `proto-${string}.html#${string}`;

export type StateRecipe =
  /** Signed out: no account, no data (the entry pages). */
  | { kind: "anonymous" }
  /** The data alone shows the state: the screen is opened after the loaders ran. */
  | { kind: "data"; loaders: readonly LoaderId[] }
  /** The loaders give the starting point; a gesture or a delayed call of the spec reaches the state. */
  | { kind: "gesture"; loaders: readonly LoaderId[] };

const ANONYMOUS: StateRecipe = { kind: "anonymous" };
const data = (...loaders: LoaderId[]): StateRecipe => ({
  kind: "data",
  loaders,
});
const gesture = (...loaders: LoaderId[]): StateRecipe => ({
  kind: "gesture",
  loaders,
});

const BY_FILE: Readonly<Record<string, Readonly<Record<string, StateRecipe>>>> =
  {
    "proto-accueils.html": {
      "marque-neuve": data("brand-bare"),
      marque: data("brand-campaigns"),
      "createur-neuf": data("creator-bare"),
      createur: data("creator-published"),
    },
    "proto-apercu.html": {
      avant: gesture("creator-published"),
      apres: gesture("creator-published"),
      "non-publie": data("creator-without-portfolio"),
      "sans-visuel": data("creator-without-portfolio"),
    },
    "proto-bo-accueil.html": {
      matin: data("agent-bare", "queue-campaigns", "queue-brand-profiles"),
      calme: data("agent-bare"),
    },
    "proto-bo-admin.html": {
      "dv-liste": data("admin-bare", "creator-verification"),
      dv: data("admin-bare", "creator-verification"),
      "dv-degrade": gesture("admin-bare"),
      invitations: gesture("admin-bare"),
      "invitation-creee": gesture("admin-bare"),
      comptes: data("admin-bare", "signups"),
      apollo: data("admin-bare"),
      sante: data("admin-bare"),
    },
    "proto-bo-campagne.html": {
      ouverte: data("agent-bare", "brand-campaigns"),
      validation: data("agent-bare", "queue-campaigns"),
      pause: data("agent-bare", "brand-campaigns"),
      close: data("agent-bare", "brand-campaigns"),
      corriger: data("agent-bare", "brand-campaigns"),
    },
    "proto-bo-decision.html": {
      decision: data("agent-bare", "queue-brand-profiles"),
      modification: data("agent-bare", "queue-brand-profiles"),
      refus: gesture("agent-bare", "queue-brand-profiles"),
    },
    "proto-bo-fiche-compte.html": {
      marque: data("agent-bare", "brand-campaigns"),
      createur: data("agent-bare", "creator-verification"),
      corriger: data("agent-bare", "creator-without-portfolio"),
      calme: data("agent-bare", "brand-bare"),
    },
    "proto-bo-listes.html": {
      file: data("agent-bare", "queue-campaigns", "queue-brand-profiles"),
      "file-retard": data("agent-bare", "queue-brand-profiles"),
      "file-vide": data("agent-bare"),
      inscrits: data("agent-bare", "signups"),
      "inscrits-recherche": gesture("agent-bare", "signups"),
    },
    "proto-bo-mobile.html": {
      provisoire: data("agent-bare"),
      files: data("agent-bare", "queue-campaigns"),
      entree: data("agent-bare", "queue-campaigns"),
      prise: data("agent-bare", "queue-campaigns"),
      refuser: gesture("agent-bare", "queue-campaigns"),
      decide: gesture("agent-bare", "queue-campaigns"),
    },
    "proto-bo-recherche.html": {
      prerempli: data("agent-bare", "creator-published"),
      libre: gesture("agent-bare", "creator-published"),
      vide: gesture("agent-bare"),
      chargement: gesture("agent-bare", "creator-published"),
    },
    "proto-campagne-marque.html": {
      publiee: data("brand-campaigns"),
      pause: data("brand-campaigns"),
      close: data("brand-campaigns"),
      validation: data("brand-campaigns"),
      corriger: data("brand-campaigns"),
    },
    "proto-campagne.html": {
      "etape-1": gesture("brand-bare"),
      "etape-2": gesture("brand-bare"),
      "etape-3": gesture("brand-bare"),
      "etape-4": gesture("brand-bare"),
      "etape-5": gesture("brand-bare"),
      verifier: gesture("brand-bare"),
      "verifier-complet": gesture("brand-bare"),
      "profil-attente": gesture("brand-draft"),
      envoyee: gesture("brand-bare"),
    },
    "proto-campagnes-createur.html": {
      fil: data("creator-bare", "brand-campaigns"),
      vide: data("creator-bare"),
      fiche: data("creator-bare", "brand-campaigns"),
      "fiche-close": data("creator-bare", "brand-campaigns"),
    },
    "proto-compte.html": {
      hub: data("creator-bare"),
      infos: gesture("creator-bare"),
      email: gesture("creator-bare"),
      "email-codes": gesture("creator-bare"),
      "email-fait": gesture("creator-bare"),
      preferences: gesture("creator-bare"),
      sessions: data("creator-bare"),
      donnees: gesture("creator-bare"),
      supprimer: gesture("creator-bare"),
    },
    "proto-entree.html": {
      porte: ANONYMOUS,
      email: ANONYMOUS,
      "email-erreur": ANONYMOUS,
      connexion: ANONYMOUS,
      code: ANONYMOUS,
      "code-connexion": ANONYMOUS,
      "code-erreur": ANONYMOUS,
      "code-aide": ANONYMOUS,
      "infos-marque": ANONYMOUS,
      "infos-createur": ANONYMOUS,
      "autre-role": ANONYMOUS,
      "email-createur": ANONYMOUS,
    },
    "proto-mes-campagnes.html": {
      liste: data("brand-campaigns"),
      pause: data("brand-campaigns"),
      "un-brouillon": data("brand-campaigns"),
      neuve: data("brand-bare"),
    },
    "proto-profil-anonyme.html": {
      profil: data("brand-search"),
      ajoute: gesture("brand-search"),
      galerie: data("brand-search"),
    },
    "proto-profil-marque.html": {
      "etape-1": gesture("brand-draft"),
      "etape-2": gesture("brand-draft"),
      "etape-2-vide": gesture("brand-draft"),
      "etape-3": gesture("brand-draft"),
      verifier: gesture("brand-draft"),
      "verifier-complet": gesture("brand-draft"),
      envoye: gesture("brand-draft"),
      profil: data("brand-bare"),
      "modif-1": gesture("brand-bare"),
      "modif-2": gesture("brand-bare"),
      "modif-3": gesture("brand-bare"),
    },
    "proto-profil.html": {
      "etape-1": gesture("creator-bare"),
      "etape-2": gesture("creator-bare"),
      "etape-3": gesture("creator-bare"),
      "etape-3-tout": gesture("creator-bare"),
      "etape-4": gesture("creator-bare"),
      "etape-5": gesture("creator-bare"),
      verifier: gesture("creator-bare"),
      profil: data("creator-published"),
      "modif-1": gesture("creator-published"),
      "modif-2": gesture("creator-published"),
      "modif-3": gesture("creator-published"),
      "modif-4": gesture("creator-published"),
      "modif-5": gesture("creator-published"),
    },
    "proto-recherche.html": {
      resultats: data("brand-search"),
      chargement: gesture("brand-search"),
      vide: gesture("brand-search"),
    },
    "proto-selections.html": {
      liste: gesture("brand-search"),
      "liste-vide": data("brand-bare"),
      selection: gesture("brand-search"),
      tableau: gesture("brand-search"),
    },
    "proto-verifications.html": {
      hub: data("creator-verification"),
      "hub-vide": data("creator-bare"),
      propriete: gesture("creator-verification"),
      "propriete-envoyee": gesture("creator-verification"),
      audience: gesture("creator-verification"),
      "audience-examen": data("creator-verification"),
      "audience-refusee": data("creator-verification"),
      "audience-accordee": data("creator-verification"),
      contestation: gesture("creator-verification"),
      "contestation-envoyee": gesture("creator-verification"),
      "contestation-maintenue": gesture("creator-verification"),
      "contestation-infirmee": gesture("creator-verification"),
    },
  };

/** The creatable states, by key: 134 of the 147 (the 13 others are in `non-recettable.ts`). */
export const STATE_RECIPES: Readonly<Record<StateKey, StateRecipe>> =
  Object.fromEntries(
    Object.entries(BY_FILE).flatMap(([file, states]) =>
      Object.entries(states).map(([state, recipe]) => [
        `${file}#${state}`,
        recipe,
      ]),
    ),
  ) as Record<StateKey, StateRecipe>;
