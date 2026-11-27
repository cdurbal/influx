"use client";

import { useState } from "react";
import { Button } from "@/components/member/ui/Button";
import { FeedCard } from "@/components/member/ui/FeedCard";
import { PhotoCard } from "@/components/member/ui/PhotoCard";
import { BoardSection, BoardState } from "./board-section.board";

// The cards of the member spaces (C31, C48; jalon RUB, line 09a): `data-board-component` is `photo-card` and `feed-card`
// (RUB-A §4). The pictures are drawn here, a few pixels each scaled by the card: no network, no real person, no
// portfolio, and no import of the landing's pictures, which G8 refuses under the KEO scopes (EC-RUB-09a-1). The cell
// « photo claire » lays the controls on a white picture, the worst case of a photo (20 §11.5; RUB-B §5, AP2). A client
// file for the heart that fills and the card that leaves its selection (useState only).

const PNG = "data:image/png;base64,";
export const PICTURES = {
  warm: `${PNG}iVBORw0KGgoAAAANSUhEUgAAAAQAAAADCAIAAAA7ljmRAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAL0lEQVQI12Oo8tLrjLKcmeW8osqPYWKS3YIizw1NwfsnxTEABbZ3RR6flXxtVR4AM9QRQetzlIoAAAAASUVORK5CYII=`,
  green: `${PNG}iVBORw0KGgoAAAANSUhEUgAAAAQAAAADCAIAAAA7ljmRAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAALklEQVQI12NQczOxjLD3zvaOqw1jcEpyDS0JSG+LqZqZzgAUKOxPbF6UO21LBQDxcA5OXMyQ1QAAAABJRU5ErkJggg==`,
  blue: `${PNG}iVBORw0KGgoAAAANSUhEUgAAAAQAAAADCAIAAAA7ljmRAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAL0lEQVQI12PQMImy8sjzjW6Kz5/G4BJUEZbak1G5oLp3CwNQoLB5Vcu0fdNWXQIAFagQs9AvVrsAAAAASUVORK5CYII=`,
  white: `${PNG}iVBORw0KGgoAAAANSUhEUgAAAAQAAAADCAIAAAA7ljmRAAAADklEQVQI12P4jwQYcHIAu4cj3SPSeXEAAAAASUVORK5CYII=`,
} as const;

const GRID = "grid grid-cols-(--grid-photo-cards) gap-x-5 gap-y-6";
const FEED_GRID = "grid grid-cols-(--grid-photo-cards) gap-4";

const TEXTS = {
  photoTitle: "Carte photo",
  photoNote:
    "C31 : la photo 4/3 (rayon 16) sur surface-raised, le badge en haut à gauche (clair, ou sombre sur voile de 82 %), le " +
    "cœur de 44 px en haut à droite (rempli en text-primary une fois ajouté, jamais vert, avec un éclat), puis l'alias en " +
    "lien étiré et la marque « vérifié » en icône bleue avec son texte pour le lecteur d'écran (RU-02). En recherche, les " +
    "visuels défilent dans une région focalisable, les points suivent le visuel vu et les flèches de 32 px paraissent au " +
    "survol ou au focus (aucune sans survol). En sélection : le premier visuel seul, la note dessous, et le cœur qui retire " +
    "la carte en fondu. Aucun montant, aucun score.",
  photoStates: {
    search: "Recherche : trois visuels, badge clair ; ajouté, badge sombre",
    light:
      "Photo claire : badge sombre, cœur, points et anneau double sur un visuel blanc",
    saving: "Ajout en cours",
    refused: "Ajout refusé : la sélection est pleine",
    empty: "Sans visuel ; visuel en attente de sa source",
    shortlist: "Sélection : premier visuel seul, note, retrait en fondu",
  },
  carousel: (alias: string) => ({
    label: `Visuels du portfolio de ${alias}`,
    previous: "Visuel précédent",
    next: "Visuel suivant",
  }),
  add: (alias: string) => `Ajouter ${alias} à Ma sélection`,
  remove: (alias: string) => `Retirer ${alias} de Ma sélection`,
  visual: (index: number, count: number, alias: string) =>
    `Visuel ${index} sur ${count} du portfolio de ${alias} : une cuisine, un plat de saison`,
  verified: { label: "Vérifié · Instagram", date: "12 novembre 2026" },
  badgeVerified: "Audience vérifiée",
  badgeNew: "Nouveau profil",
  aliasOne: "Profil 93JMS4",
  aliasTwo: "Profil 6C2RTM",
  aliasLight: "Profil 7K3MQA",
  aliasSaving: "Profil 4FD8LZ",
  aliasRefused: "Profil P2X9WB",
  aliasEmpty: "Profil R8T4NC",
  aliasPending: "Profil L5H2VE",
  aliasShortlist: "Profil Q9B7KD",
  linesOne: [
    "Cuisine végétale de saison, recettes simples pour toute la famille",
    "Cuisine · Famille · Belgique",
    "Instagram · 10 à 50 k abonnés",
  ],
  linesTwo: [
    "Soins de la peau décryptés, routines minimalistes et honnêtes",
    "Beauté · Mode · Belgique",
    "Instagram · 50 à 500 k abonnés",
  ],
  whyLabel: "Proposé car",
  whyOne: "thématique principale Cuisine ; audience en Belgique 30 à 50 %",
  refusal:
    "Ma sélection compte déjà 50 créateurs : retirez-en un pour en ajouter un autre.",
  note: "« Ton juste, très bonne qualité d'image. »",
  noteEdit: "Modifier la note",
  restore: "Remettre la carte",
  feedTitle: "Carte du fil de campagnes",
  feedNote:
    "C48 : la marque et sa plaque de 32 px, le badge daté complet (jamais une coche seule), le titre en lien étiré, " +
    "l'échéance en délai avec son icône (l'icône d'alerte et la couleur d'avertissement quand elle est proche), la méta en " +
    "14 px. Aucun bouton, aucun montant. Au survol, le contour s'éclaire et la carte monte de 2 px (couleurs seules en " +
    "mouvement réduit). Close, elle le dit et n'ouvre rien.",
  feedStates: {
    open: "Ouvertes : avec logo et badge, échéance proche ; sans logo",
    closed: "Candidatures closes",
  },
  brandOne: "Les Fermes d'Ici",
  brandTwo: "Atelier Sève",
  feedVerified: {
    label: "Vérifié",
    network: "Instagram",
    date: "3 novembre 2026",
  },
  campaignOne: "Paniers de saison : 3 recettes de l'hiver",
  campaignTwo: "Routine éclat d'hiver : sérum à la vitamine C",
  dueSoon: "Candidatures : plus que 2 jours",
  dueLater: "Candidatures : 9 jours",
  metaOne: [
    "Instagram : 1 Reel, 2 stories · produit envoyé",
    "Belgique · Cuisine et gastronomie",
  ],
  metaTwo: ["Instagram : 2 Reels · produit envoyé", "France · Beauté"],
  closed: "Candidatures closes",
} as const;

const SEARCH_VISUALS = [PICTURES.warm, PICTURES.green, PICTURES.blue];

function visualsOf(alias: string, sources: readonly string[]) {
  return sources.map((src, index) => ({
    src,
    alt: TEXTS.visual(index + 1, sources.length, alias),
  }));
}

function Why() {
  return (
    <>
      <b>{TEXTS.whyLabel}</b> {TEXTS.whyOne}
    </>
  );
}

/** Two results of a search: the heart of each fills and empties, as a screen would once its request answers. */
function SearchCell() {
  const [saved, setSaved] = useState<readonly string[]>([TEXTS.aliasTwo]);
  const toggle = (alias: string) =>
    setSaved((current) =>
      current.includes(alias)
        ? current.filter((entry) => entry !== alias)
        : [...current, alias],
    );
  return (
    <>
      {[
        {
          alias: TEXTS.aliasOne,
          lines: TEXTS.linesOne,
          badge: { label: TEXTS.badgeVerified, tone: "light" as const },
          verified: TEXTS.verified,
        },
        {
          alias: TEXTS.aliasTwo,
          lines: TEXTS.linesTwo,
          badge: { label: TEXTS.badgeNew, tone: "dark" as const },
          verified: undefined,
        },
      ].map(({ alias, lines, badge, verified }) => {
        const held = saved.includes(alias);
        return (
          <PhotoCard
            key={alias}
            variant="search"
            href="#profil"
            media={visualsOf(alias, SEARCH_VISUALS)}
            carousel={TEXTS.carousel(alias)}
            badge={badge}
            name={alias}
            verified={verified}
            lines={lines}
            why={<Why />}
            saved={held}
            saveLabel={held ? TEXTS.remove(alias) : TEXTS.add(alias)}
            onToggleSave={() => toggle(alias)}
          />
        );
      })}
    </>
  );
}

/** A card of a selection: its heart removes it, it fades out; « Remettre la carte » brings it back. */
function ShortlistCell() {
  const [leaving, setLeaving] = useState(false);
  return (
    <>
      <PhotoCard
        variant="shortlist"
        href="#profil"
        media={visualsOf(TEXTS.aliasShortlist, [PICTURES.green])}
        name={TEXTS.aliasShortlist}
        lines={TEXTS.linesTwo}
        saved
        leaving={leaving}
        saveLabel={TEXTS.remove(TEXTS.aliasShortlist)}
        onToggleSave={() => setLeaving(true)}
        note={
          <>
            <p>{TEXTS.note}</p>
            <Button variant="text" size="sm" className="self-start">
              {TEXTS.noteEdit}
            </Button>
          </>
        }
      />
      <div>
        <Button variant="secondary" size="sm" onClick={() => setLeaving(false)}>
          {TEXTS.restore}
        </Button>
      </div>
    </>
  );
}

const noop = () => undefined;

/** The cards of the member spaces, one section each. */
export function CardBoard() {
  return (
    <>
      <BoardSection
        component="photo-card"
        title={TEXTS.photoTitle}
        note={TEXTS.photoNote}
      >
        <BoardState
          state="search"
          label={TEXTS.photoStates.search}
          bare
          className={GRID}
        >
          <SearchCell />
        </BoardState>
        <BoardState
          state="light-photo"
          label={TEXTS.photoStates.light}
          bare
          className={GRID}
        >
          <PhotoCard
            variant="search"
            href="#profil"
            media={visualsOf(TEXTS.aliasLight, [PICTURES.white, PICTURES.warm])}
            carousel={TEXTS.carousel(TEXTS.aliasLight)}
            badge={{ label: TEXTS.badgeNew, tone: "dark" }}
            name={TEXTS.aliasLight}
            lines={TEXTS.linesOne}
            saveLabel={TEXTS.add(TEXTS.aliasLight)}
            onToggleSave={noop}
          />
        </BoardState>
        <BoardState
          state="saving"
          label={TEXTS.photoStates.saving}
          bare
          className={GRID}
        >
          <PhotoCard
            variant="search"
            href="#profil"
            media={visualsOf(TEXTS.aliasSaving, [PICTURES.blue])}
            carousel={TEXTS.carousel(TEXTS.aliasSaving)}
            name={TEXTS.aliasSaving}
            lines={TEXTS.linesOne}
            saving
            saveLabel={TEXTS.add(TEXTS.aliasSaving)}
            onToggleSave={noop}
          />
        </BoardState>
        <BoardState
          state="refused"
          label={TEXTS.photoStates.refused}
          bare
          className={GRID}
        >
          <PhotoCard
            variant="search"
            href="#profil"
            media={visualsOf(TEXTS.aliasRefused, [PICTURES.warm])}
            carousel={TEXTS.carousel(TEXTS.aliasRefused)}
            name={TEXTS.aliasRefused}
            lines={TEXTS.linesOne}
            refusal={TEXTS.refusal}
            saveLabel={TEXTS.add(TEXTS.aliasRefused)}
            onToggleSave={noop}
          />
        </BoardState>
        <BoardState
          state="no-visual"
          label={TEXTS.photoStates.empty}
          bare
          className={GRID}
        >
          <PhotoCard
            variant="search"
            href="#profil"
            media={[]}
            carousel={TEXTS.carousel(TEXTS.aliasEmpty)}
            name={TEXTS.aliasEmpty}
            lines={TEXTS.linesOne}
            saveLabel={TEXTS.add(TEXTS.aliasEmpty)}
            onToggleSave={noop}
          />
          <PhotoCard
            variant="search"
            href="#profil"
            media={[{ alt: TEXTS.visual(1, 1, TEXTS.aliasPending) }]}
            carousel={TEXTS.carousel(TEXTS.aliasPending)}
            name={TEXTS.aliasPending}
            lines={TEXTS.linesTwo}
            saveLabel={TEXTS.add(TEXTS.aliasPending)}
            onToggleSave={noop}
          />
        </BoardState>
        <BoardState
          state="shortlist"
          label={TEXTS.photoStates.shortlist}
          bare
          className={GRID}
        >
          <ShortlistCell />
        </BoardState>
      </BoardSection>

      <BoardSection
        component="feed-card"
        title={TEXTS.feedTitle}
        note={TEXTS.feedNote}
      >
        <BoardState
          state="open"
          label={TEXTS.feedStates.open}
          bare
          className={FEED_GRID}
        >
          <FeedCard
            href="#campagne"
            brand={TEXTS.brandOne}
            logo={PICTURES.green}
            verified={TEXTS.feedVerified}
            title={TEXTS.campaignOne}
            due={{ label: TEXTS.dueSoon, soon: true }}
            meta={TEXTS.metaOne}
          />
          <FeedCard
            href="#campagne"
            brand={TEXTS.brandTwo}
            title={TEXTS.campaignTwo}
            due={{ label: TEXTS.dueLater }}
            meta={TEXTS.metaTwo}
          />
        </BoardState>
        <BoardState
          state="closed"
          label={TEXTS.feedStates.closed}
          bare
          className={FEED_GRID}
        >
          <FeedCard
            href="#campagne"
            brand={TEXTS.brandTwo}
            title={TEXTS.campaignTwo}
            due={{ label: TEXTS.dueLater }}
            meta={TEXTS.metaTwo}
            closed={TEXTS.closed}
          />
        </BoardState>
      </BoardSection>
    </>
  );
}
