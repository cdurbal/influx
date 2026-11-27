"use client";

import { Button } from "@/components/member/ui/Button";
import { BrandHero } from "@/components/member/ui/BrandHero";
import { KeyFigures } from "@/components/member/ui/KeyFigures";
import { MediaGallery } from "@/components/member/ui/MediaGallery";
import { PreviewFrame } from "@/components/member/ui/PreviewFrame";
import { RangeBar } from "@/components/member/ui/RangeBar";
import { ReadingLayout } from "@/components/member/ui/ReadingLayout";
import { ReasonList } from "@/components/member/ui/ReasonList";
import { Section } from "@/components/member/ui/Section";
import { StatusBadge } from "@/components/member/ui/StatusBadge";
import {
  MobileActionBar,
  StickyAside,
} from "@/components/member/ui/StickyAside";
import {
  BadgeCheckIcon,
  ClockIcon,
  ImagePlusIcon,
  MapPinIcon,
  UsersIcon,
} from "@/components/ui/icons";
import { BoardSection, BoardState } from "./board-section.board";
import { PICTURES } from "./card.board";

// The components of a reading page (C34 to C37, C39, C40, C66, C68; jalon RUB, line 09b): `data-board-component` is
// their name in kebab case (RUB-A §4). The pictures are those of the cards, drawn here; the last one of the five of
// the mosaic is the white one, the worst ground of « see them all » (20 §11.5; RUB-B §5, AP2). The head of a brand
// page holds an `h1`: its cells are page-header cells, one `h1` each. The mobile bar stands in a contained cell. A
// client file for the pictures it shares with the cards.

const TEXTS = {
  galleryTitle: "Galerie",
  galleryNote:
    "C34 : dès 768 px, une mosaïque 2/1 sans case vide (écart 8, rayon 16, cinq visuels au plus) ; au-dessous, un " +
    "carrousel 4/3 et son compteur sur voile de 75 % ; un seul des deux par largeur. Chaque visuel est un bouton nommé " +
    "par ce qu'il montre ; dès deux visuels, « Voir les n visuels ». Les deux ouvrent le dialogue plein écran (deux " +
    "colonnes dès 768 px), sur le visuel choisi ; Échap ou le chevron ferment et rendent le focus.",
  galleryStates: {
    six: "Six visuels : cinq dans la mosaïque, le cinquième clair sous le bouton",
    four: "Quatre visuels",
    three: "Trois visuels",
    two: "Deux visuels",
    one: "Un visuel : ni compteur, ni piste, ni bouton",
    none: "Aucun visuel",
  },
  portfolio: "Portfolio · Profil 93JMS4",
  closeGallery: "Fermer la galerie",
  noVisual: "Ce profil n'a pas encore de visuel.",
  seeAll: (count: number) => `Voir les ${count} visuels`,
  visuals: [
    "Un bol de légumes d'automne",
    "Une soupe de potimarron",
    "Une tarte fine aux pommes",
    "Un brunch du dimanche",
    "Une nappe blanche en plein soleil",
    "Un goûter d'enfants",
  ],
  figuresTitle: "Chiffres clés",
  figuresNote:
    "C35 : trois variantes, chacune une liste de termes et de valeurs. En quatre colonnes à filets (deux sous 640 px), " +
    "le chiffre à 18, 19 puis 20 px ; l'essentiel en deux par deux avec une icône de 24 px (une colonne sous 640 px) ; " +
    "un réseau en trois colonnes. Des tranches avant la mise en relation, jamais un chiffre exact calculé ; une valeur " +
    "absente est écrite par l'écran.",
  figuresStates: {
    figures: "Quatre colonnes, la première vérifiée",
    essentials: "L'essentiel",
    network: "Un réseau",
    missing: "Valeur absente",
  },
  figures: [
    { label: "Audience vérifiée", value: "Instagram", verified: true },
    { label: "abonnés · Micro", value: "10–50 k" },
    { label: "publications par semaine", value: "Plusieurs" },
    { label: "commentaires par publication", value: "50–199" },
  ],
  essentials: [
    {
      label: "Candidatures",
      value: "Jusqu'au 3 décembre",
      sub: "dans 9 jours",
    },
    {
      label: "Publication",
      value: "Du 24 décembre au 21 janvier",
      sub: "contenus livrés avant le 18 décembre",
    },
    {
      label: "Contenus demandés",
      value: "Instagram : 2 Reels",
      sub: "validation par la marque sous 3 jours ouvrés",
    },
    {
      label: "Contrepartie",
      value: "Rémunération et produit",
      sub: "montant à négocier avec votre commercial",
    },
  ],
  network: [
    { label: "Abonnés", value: "10–50 k", sub: "Micro" },
    { label: "Rythme", value: "Plusieurs par semaine" },
    { label: "Commentaires", value: "50–199", sub: "par publication" },
  ],
  networkMissing: [
    { label: "Abonnés", value: "1–10 k", sub: "Nano" },
    { label: "Rythme", value: "Non renseigné" },
    { label: "Commentaires", value: "Non renseigné" },
  ],
  reasonsTitle: "Raisons",
  reasonsNote:
    "C36 : une icône de 24 px, un titre et sa phrase, à 16 px l'une de l'autre ; 24 px entre deux raisons, ou 16. Des " +
    "faits que l'on peut vérifier, jamais une note. Sans raison, rien n'est dessiné et l'écran retire sa section.",
  reasonsStates: {
    wide: "Écart de 24 px",
    close: "Écart de 16 px",
    empty: "Liste vide",
  },
  reasonsEmpty: "Aucune raison : la liste n'est pas dessinée.",
  reasons: [
    {
      title: "Une audience dans le pays visé",
      body: "La campagne vise la France ; votre audience Instagram y est présente.",
    },
    {
      title: "Le réseau demandé est votre réseau principal",
      body: "Instagram, audience vérifiée par INFLUX.",
    },
    {
      title: "Une communauté dans la tranche recherchée",
      body: "La marque recherche des profils Micro.",
    },
  ],
  rangesTitle: "Tranches d'audience",
  rangesNote:
    "C37 : le libellé, une barre de 8 px et la valeur écrite (9 rem et 6,5 rem ; 6,5 et 5,5 sous 480 px). La barre est " +
    "un dessin masqué aux lecteurs d'écran : la valeur écrite porte l'information.",
  rangesState: "Pays",
  ranges: [
    { label: "Belgique", from: 30, to: 50, valueLabel: "30 à 50 %" },
    { label: "France", from: 10, to: 30, valueLabel: "10 à 30 %" },
    { label: "Pays-Bas", from: 0, to: 10, valueLabel: "moins de 10 %" },
  ],
  asideTitle: "Encadré collant et barre d'action",
  asideNote:
    "C39 : dès 1 024 px, un encadré nommé de rayon 16, rembourré de 24, avec une ombre et collé à 32 px du haut ; " +
    "au-dessous, il est absent et une barre nommée, fixée au-dessus de la barre du bas, porte un texte court et une " +
    "seule action. Sans rien à faire, la barre est absente. La cellule de la barre la contient.",
  asideStates: {
    box: "Encadré, dès 1 024 px",
    bar: "Barre, sous 1 024 px",
    absent: "Barre absente",
  },
  asideLabel: "Ma sélection",
  asideHead: "Ma sélection privée",
  asideText: "Ajouter ce profil ne prévient aucun créateur.",
  asideAction: "Ajouter à ma sélection",
  barLabel: "Ajout à ma sélection",
  barHead: "Disponible sous 2 semaines",
  barText: "Privé : aucun créateur prévenu",
  barAction: "Ajouter",
  barWide: "Dès 1 024 px, la barre est absente : l'encadré la remplace.",
  absentBarLabel: "Barre d'une campagne close",
  absent: "Rien à faire : aucune barre.",
  layoutTitle: "Mise en page de lecture",
  layoutNote:
    "C40 : une colonne sous 1 024 px ; au-delà, le contenu et l'encadré en 7 / 4 (19 rem au moins), écartés de 64 px. " +
    "Un paragraphe s'arrête à 40 rem.",
  layoutState: "Contenu et encadré",
  layoutAsideLabel: "Candidature",
  layoutSection: "Ligne éditoriale",
  layoutText:
    "Des recettes végétales de saison, testées dans une cuisine de famille, avec des formats courts et des textes " +
    "précis. Les collaborations suivent les mêmes valeurs que les publications ordinaires.",
  layoutAside: "Candidatures jusqu'au 3 décembre.",
  previewTitle: "Cadre d'aperçu",
  previewNote:
    "C66 : une zone sous un filet, coiffée d'« Aperçu » en capitales, ou un bandeau d'information en tirets. Le contenu " +
    "est le vrai ; une action sans effet reste lisible, indisponible et expliquée, sans opacité.",
  previewStates: { zone: "Zone", strip: "Bandeau" },
  previewZone: "Aperçu",
  previewStrip:
    "Version soumise, non publiée. C'est ce que les créateurs verront si le profil est publié.",
  previewAction: "Candidater",
  previewReason: "Dans un aperçu, ce bouton ne fait rien.",
  previewContent: "Paniers de saison : 3 recettes de l'hiver",
  heroTitle: "En-tête de marque",
  heroNote:
    "C68 : à la place de la galerie, le logo de 120 px sur sa pastille claire (72 px sous 640 px, en une colonne), le " +
    "titre à 28, 32 puis 36 px, le badge daté et le secteur. Sans logo, les initiales.",
  heroStates: { logo: "Avec logo et badge", initials: "Sans logo" },
  heroName: "Les Fermes d'Ici",
  heroOther: "Atelier Sève",
  heroBadge: "Marque vérifiée · 3 novembre 2026",
  heroMeta: "Alimentation et boissons · Belgique",
  heroOtherMeta: "Beauté · France",
} as const;

const VISUAL_SOURCES = [
  PICTURES.warm,
  PICTURES.green,
  PICTURES.blue,
  PICTURES.warm,
  PICTURES.white,
  PICTURES.green,
];

/** The first `count` visuals of the portfolio, each one with its picture, its words and its caption. */
function visualsOf(count: number) {
  return TEXTS.visuals.slice(0, count).map((words, index) => ({
    src: VISUAL_SOURCES[index] ?? PICTURES.warm,
    alt: `Visuel ${index + 1} : ${words}`,
    caption: words,
  }));
}

const GALLERIES = [
  { state: "six", count: 6 },
  { state: "four", count: 4 },
  { state: "three", count: 3 },
  { state: "two", count: 2 },
  { state: "one", count: 1 },
  { state: "none", count: 0 },
] as const;

const ESSENTIAL_ICONS = [ClockIcon, ClockIcon, ImagePlusIcon, UsersIcon];
const REASON_ICONS = [MapPinIcon, BadgeCheckIcon, UsersIcon];

const reasons = TEXTS.reasons.map((reason, index) => ({
  ...reason,
  icon: REASON_ICONS[index] ?? BadgeCheckIcon,
}));

const noop = () => undefined;

/** The reading components, one section each. */
export function ReadingBoard() {
  return (
    <>
      <BoardSection
        component="media-gallery"
        title={TEXTS.galleryTitle}
        note={TEXTS.galleryNote}
      >
        {GALLERIES.map(({ state, count }) => (
          <BoardState
            key={state}
            state={state}
            label={TEXTS.galleryStates[state]}
            bare
          >
            <MediaGallery
              items={visualsOf(count)}
              title={TEXTS.portfolio}
              closeLabel={TEXTS.closeGallery}
              allLabel={TEXTS.seeAll(count)}
              emptyLabel={TEXTS.noVisual}
            />
          </BoardState>
        ))}
      </BoardSection>

      <BoardSection
        component="key-figures"
        title={TEXTS.figuresTitle}
        note={TEXTS.figuresNote}
      >
        <BoardState state="figures" label={TEXTS.figuresStates.figures} bare>
          <KeyFigures variant="figures" items={[...TEXTS.figures]} />
        </BoardState>
        <BoardState
          state="essentials"
          label={TEXTS.figuresStates.essentials}
          bare
        >
          <KeyFigures
            variant="essentials"
            items={TEXTS.essentials.map((item, index) => ({
              ...item,
              icon: ESSENTIAL_ICONS[index],
            }))}
          />
        </BoardState>
        <BoardState state="network" label={TEXTS.figuresStates.network} bare>
          <KeyFigures variant="network" items={[...TEXTS.network]} />
        </BoardState>
        <BoardState state="missing" label={TEXTS.figuresStates.missing} bare>
          <KeyFigures variant="network" items={[...TEXTS.networkMissing]} />
        </BoardState>
      </BoardSection>

      <BoardSection
        component="reason-list"
        title={TEXTS.reasonsTitle}
        note={TEXTS.reasonsNote}
      >
        <BoardState state="wide" label={TEXTS.reasonsStates.wide} bare>
          <ReasonList items={reasons} />
        </BoardState>
        <BoardState state="close" label={TEXTS.reasonsStates.close} bare>
          <ReasonList items={reasons} gap="md" />
        </BoardState>
        <BoardState state="empty" label={TEXTS.reasonsStates.empty} bare>
          <p className="text-sm text-text-secondary">{TEXTS.reasonsEmpty}</p>
          <ReasonList items={[]} />
        </BoardState>
      </BoardSection>

      <BoardSection
        component="range-bar"
        title={TEXTS.rangesTitle}
        note={TEXTS.rangesNote}
      >
        <BoardState state="countries" label={TEXTS.rangesState}>
          <RangeBar items={[...TEXTS.ranges]} className="w-full" />
        </BoardState>
      </BoardSection>

      <BoardSection
        component="sticky-aside"
        title={TEXTS.asideTitle}
        note={TEXTS.asideNote}
      >
        <BoardState state="box" label={TEXTS.asideStates.box} bare>
          <StickyAside label={TEXTS.asideLabel}>
            <p className="font-display font-bold">{TEXTS.asideHead}</p>
            <p className="text-sm text-text-secondary">{TEXTS.asideText}</p>
            <Button block onClick={noop}>
              {TEXTS.asideAction}
            </Button>
          </StickyAside>
        </BoardState>
        <BoardState
          state="bar"
          label={TEXTS.asideStates.bar}
          bare
          className="contain-layout max-lg:min-h-(--size-header-glow)"
        >
          <p className="text-sm text-text-secondary max-lg:hidden">
            {TEXTS.barWide}
          </p>
          <MobileActionBar
            label={TEXTS.barLabel}
            text={
              <>
                <span className="font-display font-bold">{TEXTS.barHead}</span>
                <span className="text-xs text-text-secondary">
                  {TEXTS.barText}
                </span>
              </>
            }
            action={
              <Button size="bar" onClick={noop}>
                {TEXTS.barAction}
              </Button>
            }
          />
        </BoardState>
        <BoardState state="absent" label={TEXTS.asideStates.absent} bare>
          <p className="text-sm text-text-secondary">{TEXTS.absent}</p>
          <MobileActionBar
            hidden
            label={TEXTS.absentBarLabel}
            text={TEXTS.barHead}
            action={null}
          />
        </BoardState>
      </BoardSection>

      <BoardSection
        component="reading-layout"
        title={TEXTS.layoutTitle}
        note={TEXTS.layoutNote}
      >
        <BoardState state="columns" label={TEXTS.layoutState} bare>
          <ReadingLayout
            main={
              <Section title={TEXTS.layoutSection} as="h3" variant="reading">
                <p>{TEXTS.layoutText}</p>
              </Section>
            }
            asideLabel={TEXTS.layoutAsideLabel}
            aside={<p>{TEXTS.layoutAside}</p>}
          />
        </BoardState>
      </BoardSection>

      <BoardSection
        component="preview-frame"
        title={TEXTS.previewTitle}
        note={TEXTS.previewNote}
      >
        {(["zone", "strip"] as const).map((variant) => (
          <BoardState
            key={variant}
            state={variant}
            label={TEXTS.previewStates[variant]}
            bare
          >
            <PreviewFrame
              variant={variant}
              label={
                variant === "zone" ? TEXTS.previewZone : TEXTS.previewStrip
              }
            >
              <p className="font-display font-bold">{TEXTS.previewContent}</p>
              <div className="flex flex-col items-start gap-2">
                <Button disabledReason={`board-preview-reason-${variant}`}>
                  {TEXTS.previewAction}
                </Button>
                <p
                  id={`board-preview-reason-${variant}`}
                  className="text-sm text-text-secondary"
                >
                  {TEXTS.previewReason}
                </p>
              </div>
            </PreviewFrame>
          </BoardState>
        ))}
      </BoardSection>

      <BoardSection
        component="brand-hero"
        title={TEXTS.heroTitle}
        note={TEXTS.heroNote}
      >
        <BoardState
          state="page-header-brand-hero-logo"
          label={TEXTS.heroStates.logo}
          bare
        >
          <BrandHero
            name={TEXTS.heroName}
            logo={PICTURES.green}
            badge={
              <StatusBadge tone="verified" icon={BadgeCheckIcon}>
                {TEXTS.heroBadge}
              </StatusBadge>
            }
            meta={TEXTS.heroMeta}
          />
        </BoardState>
        <BoardState
          state="page-header-brand-hero-initials"
          label={TEXTS.heroStates.initials}
          bare
        >
          <BrandHero name={TEXTS.heroOther} meta={TEXTS.heroOtherMeta} />
        </BoardState>
      </BoardSection>
    </>
  );
}
