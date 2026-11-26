import { Button } from "@/components/member/ui/Button";
import { EmptyState } from "@/components/member/ui/EmptyState";
import { LogoPlate } from "@/components/member/ui/LogoPlate";
import {
  PropertyList,
  type PropertyListItem,
} from "@/components/member/ui/PropertyList";
import { RowList, type RowListItem } from "@/components/member/ui/RowList";
import type { RowListVariant } from "@/components/member/ui/row-list-classes";
import { Skeleton } from "@/components/member/ui/Skeleton";
import type { SkeletonShape } from "@/components/member/ui/skeleton-classes";
import { StatusBadge } from "@/components/member/ui/StatusBadge";
import type { EmptyStateKind } from "@/components/member/ui/empty-state-classes";
import { UserRoundIcon } from "@/components/ui/icons";
import { BoardSection, BoardState } from "./board-section.board";

const TEXTS = {
  rowsTitle: "Liste de lignes",
  rowsNote:
    "C06 : huit variantes, les autres formes des maquettes sont des combinaisons de champs. Le lien du titre couvre la " +
    "ligne, son anneau est dessiné à l'intérieur ; une action reste au-dessus du lien. Survol : fond surface-raised en " +
    "120 ms. Piles : campagne sous 768 px, liste sous 640, séances sous 480.",
  propertiesTitle: "Liste de propriétés",
  propertiesNote:
    "C07 : un dl dont les seuls enfants sont les libellés et leurs valeurs ; valeur vide en texte tertiaire, largeur des " +
    "libellés par palier, deux listes côte à côte dès 1 280 px.",
  emptyTitle: "Message d'état",
  emptyNote:
    "C08 : six sortes, une action au plus ; le titre est un paragraphe au style d'un titre de section, jamais un niveau " +
    "de titre. « Filtré » propose de réinitialiser, jamais de créer.",
  skeletonTitle: "Squelette",
  skeletonNote:
    "C09 : cinq formes à la hauteur du contenu, rien avant 1 s, conteneur aria-busy, texte « Chargement… » hors écran, " +
    "formes cachées aux lecteurs d'écran ; le reflet traverse chaque forme en 1,2 s, il est supprimé sous mouvement réduit.",
  loading: "Chargement…",
  draft: "Brouillon",
  online: "En ligne",
  toComplete: "À compléter",
  done: "Fait",
  signOut: "Déconnecter",
  liveTitle: "La liste n'a pas pu être rechargée",
} as const;

const EXAMPLE_LINK = "/fr/exemple";

const campaign = (
  id: string,
  title: string,
  extra: Partial<RowListItem> = {},
): RowListItem => ({
  id,
  href: EXAMPLE_LINK,
  title,
  ...extra,
});

const BADGE = <StatusBadge tone="neutral">{TEXTS.draft}</StatusBadge>;

const ROW_CELLS: ReadonlyArray<{
  state: string;
  label: string;
  variant: RowListVariant;
  items: RowListItem[];
}> = [
  {
    state: "campaign",
    label: "Campagne : titre, état, date, chevron",
    variant: "campaign",
    items: [
      campaign("a", "Coffret de fêtes", { meta: BADGE, end: "12 janv. 2027" }),
      campaign("b", "Collection de printemps", {
        meta: <StatusBadge tone="success">{TEXTS.online}</StatusBadge>,
        end: "3 mars 2027",
      }),
    ],
  },
  {
    state: "campaign-meta",
    label: "Campagne sans date : l'état à droite",
    variant: "campaign",
    items: [
      campaign("a", "Coffret de fêtes", { meta: BADGE }),
      campaign("b", "Collection de printemps", {
        meta: <StatusBadge tone="success">{TEXTS.online}</StatusBadge>,
      }),
    ],
  },
  {
    state: "campaign-sub",
    label: "Campagne avec une phrase seule",
    variant: "campaign",
    items: [
      campaign("a", "Atelier Exemple", { sub: "3 campagnes ouvertes" }),
      campaign("b", "Maison Exemple", { sub: "1 campagne ouverte" }),
    ],
  },
  {
    state: "feed",
    label: "Fil : logo, texte, chevron",
    variant: "feed",
    items: [
      campaign("a", "Atelier Exemple", {
        sub: "Cosmétique · France",
        media: <LogoPlate name="Atelier Exemple" size={40} shape="plate" />,
      }),
    ],
  },
  {
    state: "lists",
    label: "Listes : vignettes masquées sous 640 px",
    variant: "lists",
    items: [
      campaign("a", "Favoris du printemps", {
        sub: "12 profils",
        media: <LogoPlate name="Favoris" size={48} shape="plate" />,
      }),
    ],
  },
  {
    state: "tasks",
    label: "Tâches : titre et statut, filets plus marqués",
    variant: "tasks",
    items: [
      campaign("a", "Présenter votre marque", {
        meta: <StatusBadge tone="warning">{TEXTS.toComplete}</StatusBadge>,
        sub: "Quelques phrases suffisent.",
      }),
      campaign("b", "Ajouter un logo", {
        meta: <StatusBadge tone="success">{TEXTS.done}</StatusBadge>,
      }),
    ],
  },
  {
    state: "hub",
    label: "Hub : icône, titre, phrase, chevron",
    variant: "hub",
    items: [
      campaign("a", "Mes informations", {
        sub: "Nom, pays et langue.",
        media: <UserRoundIcon aria-hidden="true" className="size-5" />,
      }),
    ],
  },
  {
    state: "sessions",
    label: "Sessions : icône, texte, action ; pile sous 480 px",
    variant: "sessions",
    items: [
      {
        id: "a",
        title: "Navigateur de bureau",
        sub: "Dernière activité : aujourd'hui",
        media: <UserRoundIcon aria-hidden="true" className="size-5" />,
        action: (
          <Button variant="secondary" size="sm">
            {TEXTS.signOut}
          </Button>
        ),
      },
    ],
  },
  {
    state: "todo",
    label: "À faire (backoffice) : hauteur libre, 14 et 12 px",
    variant: "todo",
    items: [
      { id: "a", title: "Valider une preuve", sub: "Reçue hier", meta: "J+1" },
    ],
  },
  {
    state: "mini",
    label: "Mini (backoffice) : 36 px, media et sous-ligne en haut",
    variant: "mini",
    items: [
      campaign("a", "Dossier à relire"),
      campaign("b", "Alerte de file", {
        sub: "Hors délai",
        media: <UserRoundIcon aria-hidden="true" className="size-5" />,
      }),
    ],
  },
  {
    state: "current",
    label: "Ligne courante, ligne faite, ligne à traiter, ligne sans lien",
    variant: "tasks",
    items: [
      campaign("a", "Étape en cours", { current: true, meta: "En cours" }),
      campaign("b", "Étape faite", { tone: "done", meta: "Faite" }),
      campaign("c", "Étape à traiter", {
        tone: "attention",
        meta: "À traiter",
      }),
      { id: "d", title: "Sans lien", meta: "Information" },
    ],
  },
];

const PROPERTIES: PropertyListItem[] = [
  { label: "Marque", value: "Atelier Exemple" },
  { label: "Pays", value: "France" },
  { label: "Site", value: "example.test", mark: "Modifié" },
  { label: "Présentation", value: "", empty: true },
  { label: "Réseaux", value: "2 réseaux", sub: "Instagram, TikTok" },
  { label: "Adresse de contact", value: "contact@example.test" },
];

const EMPTY_KINDS: ReadonlyArray<{
  kind: EmptyStateKind;
  label: string;
  title: string;
  body?: string;
  action?: string;
}> = [
  {
    kind: "empty",
    label: "Vide",
    title: "Aucune campagne pour l'instant",
    body: "Vos campagnes apparaîtront ici dès leur création.",
    action: "Créer une campagne",
  },
  {
    kind: "filtered",
    label: "Filtré",
    title: "Aucun résultat avec ces filtres",
    body: "Élargissez votre recherche.",
    action: "Réinitialiser",
  },
  {
    kind: "error",
    label: "Erreur",
    title: "Impossible de charger la liste",
    body: "Réessayez dans un instant.",
    action: "Réessayer",
  },
  {
    kind: "closed",
    label: "Clos",
    title: "Cette campagne est terminée",
    body: "Elle n'accepte plus de candidatures.",
  },
  {
    kind: "sent",
    label: "Envoyé",
    title: "Votre demande est envoyée",
    body: "Votre commercial vous répond sous un jour ouvré.",
  },
  { kind: "inline", label: "En ligne", title: "Tout est à jour." },
];

const SKELETON_SHAPES: ReadonlyArray<{
  shape: SkeletonShape;
  label: string;
  count: number;
}> = [
  { shape: "line", label: "Lignes", count: 3 },
  { shape: "row", label: "Lignes de liste", count: 2 },
  { shape: "card", label: "Carte : photo 4/3 et trois lignes", count: 1 },
  { shape: "photo", label: "Photo", count: 1 },
  { shape: "field", label: "Champ", count: 1 },
];

/** The lists, the properties and the states of the member spaces (02c C06 to C09), on synthetic data. */
export function ListBoard() {
  return (
    <>
      <BoardSection
        component="row-list"
        title={TEXTS.rowsTitle}
        note={TEXTS.rowsNote}
      >
        {ROW_CELLS.map(({ state, label, variant, items }) => (
          <BoardState
            key={state}
            state={state}
            label={label}
            className="flex-col"
          >
            <RowList
              variant={variant}
              items={items}
              label={label}
              className="w-full"
            />
          </BoardState>
        ))}
      </BoardSection>
      <BoardSection
        component="property-list"
        title={TEXTS.propertiesTitle}
        note={TEXTS.propertiesNote}
      >
        <BoardState
          state="standard"
          label="Taille 14 px, libellé standard, valeur vide, marque, sous-ligne"
          className="flex-col"
        >
          <PropertyList
            items={PROPERTIES}
            emptyLabel="Non renseigné"
            className="w-full"
          />
        </BoardState>
        <BoardState
          state="two-columns"
          label="Deux colonnes dès 1 280 px, 16 px, libellé de lecture"
          className="flex-col"
        >
          <PropertyList
            items={PROPERTIES}
            size="md"
            labelWidth="reading"
            columns={2}
            emptyLabel="Non renseigné"
            className="w-full"
          />
        </BoardState>
        <BoardState
          state="dense"
          label="Colonne dense 12 px, libellé compact"
          className="flex-col"
        >
          <PropertyList
            items={PROPERTIES.slice(0, 4)}
            size="xs"
            labelWidth="compact"
            emptyLabel="Non renseigné"
            className="w-full"
          />
        </BoardState>
      </BoardSection>
      <BoardSection
        component="empty-state"
        title={TEXTS.emptyTitle}
        note={TEXTS.emptyNote}
      >
        {EMPTY_KINDS.map(({ kind, label, title, body, action }) => (
          <BoardState
            key={kind}
            state={kind}
            label={label}
            className="flex-col"
          >
            <EmptyState
              kind={kind}
              title={title}
              body={body}
              action={
                action === undefined ? undefined : (
                  <Button
                    variant={kind === "filtered" ? "secondary" : "primary"}
                  >
                    {action}
                  </Button>
                )
              }
            />
          </BoardState>
        ))}
        <BoardState
          state="error-live"
          label="Erreur annoncée à l'apparition"
          className="flex-col"
        >
          <EmptyState kind="error" title={TEXTS.liveTitle} live />
        </BoardState>
      </BoardSection>
      <BoardSection
        component="skeleton"
        title={TEXTS.skeletonTitle}
        note={TEXTS.skeletonNote}
      >
        {SKELETON_SHAPES.map(({ shape, label, count }) => (
          <BoardState
            key={shape}
            state={shape}
            label={label}
            className="flex-col"
          >
            <Skeleton
              shape={shape}
              count={count}
              label={TEXTS.loading}
              className="w-full"
            />
          </BoardState>
        ))}
      </BoardSection>
    </>
  );
}
