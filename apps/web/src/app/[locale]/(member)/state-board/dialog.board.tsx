"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/member/ui/Button";
import { Dialog } from "@/components/member/ui/Dialog";
import { FilterBar } from "@/components/member/ui/FilterBar";
import { FiltersDialog } from "@/components/member/ui/FiltersDialog";
import { Pager } from "@/components/member/ui/Pager";
import { memberChoiceRowClasses } from "@/components/member/ui/field-classes";
import { SEGMENT_FIELDSET_CLASSES } from "@/components/member/ui/segmented-control-classes";
import { ErrorNotice } from "@/components/ui/ErrorNotice";
import { BoardSection, BoardState } from "./board-section.board";

const TEXTS = {
  dialogTitle: "Dialogue",
  dialogNote:
    "C27 : le dialogue natif, modal, de 30 rem (34 rem en large), sur la surface relevée avec son voile. Il s'ouvre en " +
    "200 ms (fondu et échelle de 0,98 à 1) et se ferme en 120 ms ; sous mouvement réduit, le fondu seul, instantané. " +
    "Échap et le voile le ferment, sauf pendant un envoi ; le focus va à l'élément demandé, sinon au titre, et revient " +
    "au bouton qui l'a ouvert. Réservé aux confirmations, à l'identité et à l'aide.",
  dialogStates: {
    confirm: "Confirmation",
    wide: "Large",
    busy: "En cours : Échap et le voile sont sans effet",
    error: "Erreur",
    focus: "Focus initial demandé",
  },
  cancel: "Annuler",
  confirmAction: "Retirer",
  confirmOpen: "Ouvrir la confirmation",
  confirmTitle: "Retirer cette sélection ?",
  confirmText: "Les créateurs qu'elle contient restent dans votre recherche.",
  wideOpen: "Ouvrir le dialogue large",
  wideTitle: "Comment lire un profil anonymisé",
  wideText:
    "Un profil anonymisé montre ce que le créateur publie et l'audience qu'il touche, par tranches, sans son nom. Son " +
    "identité n'est révélée qu'après l'accord des deux parties, par votre commercial INFLUX.",
  wideMore:
    "Les tranches protègent les créateurs : un chiffre exact permettrait de les reconnaître, et le commercial peut vous " +
    "dire ce que la tranche recouvre.",
  close: "Fermer",
  busyOpen: "Ouvrir le dialogue en cours",
  busyTitle: "Envoi de la demande",
  busyText: "Ne fermez pas cette fenêtre : l'envoi se termine.",
  busyAction: "Envoyer",
  busyActionBusy: "Envoi…",
  busyFinish: "Terminer l'envoi",
  errorOpen: "Ouvrir le dialogue d'erreur",
  errorTitle: "La demande n'est pas partie",
  errorText: "L'envoi a échoué. Réessayez dans un instant.",
  errorRetry: "Réessayer",
  focusOpen: "Ouvrir le dialogue au focus demandé",
  focusTitle: "Supprimer ce brouillon ?",
  focusText: "Le focus arrive sur « Garder », le geste sans conséquence.",
  focusKeep: "Garder",
  focusDelete: "Supprimer",
  filtersTitle: "Dialogue des filtres",
  filtersNote:
    "C28 : tous les critères dans un dialogue de 42 rem au plus et de 85 % de la hauteur, l'en-tête et le pied fixes, " +
    "le corps qui défile, un filet entre les groupes ; l'écran entier sous 768 px. Rien ne s'applique avant « Voir les " +
    "résultats » : la croix, Échap et le voile abandonnent le brouillon, que les groupes retrouvent vierge à la " +
    "réouverture.",
  filtersState: "Fermé, avec ses critères appliqués",
  filtersOpen: "Ouvrir les filtres",
  filtersHeading: "Filtres",
  filtersApplied: (count: number) => `Critères appliqués : ${count}`,
  filtersApply: (count: number) =>
    count === 1 ? "Voir le résultat" : `Voir les ${count} résultats`,
  filtersClear: "Tout effacer",
  filtersClose: "Fermer les filtres",
  groupNetworks: "Réseaux",
  groupKeyword: "Mot-clé",
  keywordLabel: "Mot-clé de la recherche",
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  barTitle: "Barre de filtres",
  barNote:
    "C30 : des pastilles de 40 px (36 pour le backoffice), une ligne qui défile pour les membres, qui passe à la ligne " +
    "pour le backoffice. Une pastille bascule dit son état par aria-pressed ; une pastille à menu par aria-haspopup, " +
    "aria-expanded et un chevron qui se retourne à l'ouverture ; la croix qui retire un critère est un bouton à part. " +
    "L'état actif se lit au contour, au fond et à la graisse, jamais à la couleur seule.",
  barStates: {
    members: "Membres : une ligne",
    menu: "Pastille à menu ouverte",
    overflow: "Plus de critères que de place : la ligne défile",
    bo: "Backoffice : à la ligne, avec recherche et sélecteurs",
  },
  barLabel: "Critères de recherche",
  filtersButton: "Filtres",
  filtersCount: (count: number) => `${count} filtres actifs`,
  pillAvailable: "Disponible cette semaine",
  pillCountry: "Pays d'audience : Belgique",
  pillCountryClear: "Retirer le critère : Pays d'audience : Belgique",
  pillTheme: "Thématique",
  pillNetwork: "Réseaux",
  pillVerified: "Compte vérifié",
  pillVerifiedClear: "Retirer le critère : Compte vérifié",
  pillLanguage: "Langue de publication",
  pillFormat: "Format",
  pillBand: "Tranche d'audience",
  searchLabel: "Chercher un compte",
  sortLabel: "Trier par",
  sortRecent: "Plus récents",
  sortName: "Nom",
  stateLabel: "État",
  stateAll: "Tous",
  stateLate: "En retard",
  pagerTitle: "Pied de liste",
  pagerNote:
    "C32 : « Précédent » et « Suivant » avec la position écrite entre les deux. La dernière page n'a pas de « Suivant » " +
    "et garde sa place ; au plafond des résultats, l'écran l'explique par une notice. Le total du backoffice est sur la " +
    "même ligne que la position. Un groupe nommé, jamais un nav.",
  pagerStates: {
    pages: "Pages numérotées",
    first: "Première page",
    last: "Dernière page",
    cap: "Plafond atteint",
    busy: "En cours : les deux boutons sont indisponibles",
    cursor: "Curseur, avec le total",
  },
  pagerLabel: "Pages de résultats",
  previous: "Page précédente",
  next: "Page suivante",
  pageSummary: (page: number, count: number) => `Page ${page} sur ${count}`,
  capSummary: "Page 5, la dernière que la recherche atteint",
  total: "128 créateurs",
  cursorSummary: "Résultats 26 à 50",
} as const;

type DemoProps = { openLabel: string };

function ConfirmDemo({ openLabel }: DemoProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        {openLabel}
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={TEXTS.confirmTitle}
        actions={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              {TEXTS.cancel}
            </Button>
            <Button variant="danger" onClick={() => setOpen(false)}>
              {TEXTS.confirmAction}
            </Button>
          </>
        }
      >
        <p>{TEXTS.confirmText}</p>
      </Dialog>
    </>
  );
}

function WideDemo({ openLabel }: DemoProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        {openLabel}
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={TEXTS.wideTitle}
        size="wide"
        actions={<Button onClick={() => setOpen(false)}>{TEXTS.close}</Button>}
      >
        <p>{TEXTS.wideText}</p>
        <p>{TEXTS.wideMore}</p>
      </Dialog>
    </>
  );
}

function BusyDemo({ openLabel }: DemoProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        {openLabel}
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={TEXTS.busyTitle}
        dismissible={false}
        actions={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              {TEXTS.busyFinish}
            </Button>
            <Button busy busyLabel={TEXTS.busyActionBusy}>
              {TEXTS.busyAction}
            </Button>
          </>
        }
      >
        <p>{TEXTS.busyText}</p>
      </Dialog>
    </>
  );
}

function ErrorDemo({ openLabel }: DemoProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        {openLabel}
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={TEXTS.errorTitle}
        actions={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              {TEXTS.cancel}
            </Button>
            <Button onClick={() => setOpen(false)}>{TEXTS.errorRetry}</Button>
          </>
        }
      >
        <ErrorNotice>{TEXTS.errorText}</ErrorNotice>
      </Dialog>
    </>
  );
}

function FocusDemo({ openLabel }: DemoProps) {
  const [open, setOpen] = useState(false);
  const keep = useRef<HTMLButtonElement>(null);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        {openLabel}
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={TEXTS.focusTitle}
        initialFocus={keep}
        actions={
          <>
            <Button variant="danger" onClick={() => setOpen(false)}>
              {TEXTS.focusDelete}
            </Button>
            <Button
              ref={keep}
              variant="secondary"
              onClick={() => setOpen(false)}
            >
              {TEXTS.focusKeep}
            </Button>
          </>
        }
      >
        <p>{TEXTS.focusText}</p>
      </Dialog>
    </>
  );
}

function DialogStates() {
  return (
    <BoardSection
      component="dialog"
      title={TEXTS.dialogTitle}
      note={TEXTS.dialogNote}
    >
      <BoardState state="confirm" label={TEXTS.dialogStates.confirm}>
        <ConfirmDemo openLabel={TEXTS.confirmOpen} />
      </BoardState>
      <BoardState state="wide" label={TEXTS.dialogStates.wide}>
        <WideDemo openLabel={TEXTS.wideOpen} />
      </BoardState>
      <BoardState state="busy" label={TEXTS.dialogStates.busy}>
        <BusyDemo openLabel={TEXTS.busyOpen} />
      </BoardState>
      <BoardState state="error" label={TEXTS.dialogStates.error}>
        <ErrorDemo openLabel={TEXTS.errorOpen} />
      </BoardState>
      <BoardState state="focus" label={TEXTS.dialogStates.focus}>
        <FocusDemo openLabel={TEXTS.focusOpen} />
      </BoardState>
    </BoardSection>
  );
}

const NETWORKS = [
  { id: "instagram", label: TEXTS.instagram },
  { id: "tiktok", label: TEXTS.tiktok },
  { id: "youtube", label: TEXTS.youtube },
] as const;

/** The page owns the criteria that apply and the draft; the dialog only shows the draft and says when to apply it. */
function FiltersDemo() {
  const [open, setOpen] = useState(false);
  const [applied, setApplied] = useState<readonly string[]>([]);
  const [draft, setDraft] = useState<readonly string[]>([]);
  const show = () => {
    setDraft(applied);
    setOpen(true);
  };
  const toggle = (id: string) =>
    setDraft((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  return (
    <>
      <Button variant="secondary" onClick={show}>
        {TEXTS.filtersOpen}
      </Button>
      <p className="text-sm text-text-secondary" data-board-applied="">
        {TEXTS.filtersApplied(applied.length)}
      </p>
      <FiltersDialog
        open={open}
        onClose={() => setOpen(false)}
        title={TEXTS.filtersHeading}
        activeCount={draft.length}
        applyLabel={TEXTS.filtersApply(draft.length)}
        clearLabel={TEXTS.filtersClear}
        closeLabel={TEXTS.filtersClose}
        onClear={() => setDraft([])}
        onApply={() => {
          setApplied(draft);
          setOpen(false);
        }}
        groups={[
          <fieldset key="networks" className={SEGMENT_FIELDSET_CLASSES}>
            <legend className="font-display text-md font-bold">
              {TEXTS.groupNetworks}
            </legend>
            {NETWORKS.map((network) => (
              <label key={network.id} className={memberChoiceRowClasses()}>
                <input
                  type="checkbox"
                  checked={draft.includes(network.id)}
                  onChange={() => toggle(network.id)}
                />
                {network.label}
              </label>
            ))}
          </fieldset>,
          <label key="keyword" className="flex flex-col gap-2">
            <span className="font-display text-md font-bold">
              {TEXTS.groupKeyword}
            </span>
            <input
              type="search"
              aria-label={TEXTS.keywordLabel}
              className="min-h-(--size-input) rounded-md border-(length:--border-width-thin) border-border-strong bg-surface-page px-4 text-md text-text-primary"
            />
          </label>,
        ]}
      />
    </>
  );
}

function FiltersStates() {
  return (
    <BoardSection
      component="filters-dialog"
      title={TEXTS.filtersTitle}
      note={TEXTS.filtersNote}
    >
      <BoardState state="closed" label={TEXTS.filtersState}>
        <FiltersDemo />
      </BoardState>
    </BoardSection>
  );
}

/** A pill with a menu that opens and closes itself, so that the chevron and `aria-expanded` are seen turning. */
function MenuPillBar() {
  const [open, setOpen] = useState(false);
  return (
    <FilterBar
      label={TEXTS.barLabel}
      pills={[
        {
          id: "theme",
          label: TEXTS.pillTheme,
          onOpen: () => setOpen((value) => !value),
          expanded: open,
        },
        { id: "network", label: TEXTS.pillNetwork, onOpen: () => undefined },
      ]}
    />
  );
}

function MembersBar() {
  const [available, setAvailable] = useState(false);
  const [verified, setVerified] = useState(true);
  const [country, setCountry] = useState(true);
  return (
    <FilterBar
      label={TEXTS.barLabel}
      filtersButton={{
        label: TEXTS.filtersButton,
        count: 2,
        countLabel: TEXTS.filtersCount(2),
        onOpen: () => undefined,
      }}
      pills={[
        ...(country
          ? [
              {
                id: "country",
                label: TEXTS.pillCountry,
                active: true,
                onClear: () => setCountry(false),
                clearLabel: TEXTS.pillCountryClear,
              },
            ]
          : []),
        {
          id: "available",
          label: TEXTS.pillAvailable,
          active: available,
          onToggle: () => setAvailable((value) => !value),
        },
        {
          id: "verified",
          label: TEXTS.pillVerified,
          active: verified,
          onToggle: () => setVerified((value) => !value),
          onClear: verified ? () => setVerified(false) : undefined,
          clearLabel: verified ? TEXTS.pillVerifiedClear : undefined,
        },
        { id: "theme", label: TEXTS.pillTheme, onOpen: () => undefined },
      ]}
    />
  );
}

function BackofficeBar() {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("recent");
  const [state, setState] = useState("all");
  return (
    <FilterBar
      density="bo"
      label={TEXTS.barLabel}
      pills={[
        { id: "late", label: TEXTS.stateLate, onToggle: () => undefined },
        { id: "theme", label: TEXTS.pillTheme, onOpen: () => undefined },
      ]}
      search={{
        value: query,
        onChange: setQuery,
        onSubmit: () => undefined,
        label: TEXTS.searchLabel,
      }}
      selects={[
        {
          id: "sort",
          label: TEXTS.sortLabel,
          value: sort,
          onChange: setSort,
          options: [
            { value: "recent", label: TEXTS.sortRecent },
            { value: "name", label: TEXTS.sortName },
          ],
        },
        {
          id: "state",
          label: TEXTS.stateLabel,
          value: state,
          onChange: setState,
          options: [
            { value: "all", label: TEXTS.stateAll },
            { value: "late", label: TEXTS.stateLate },
          ],
        },
      ]}
    />
  );
}

function BarStates() {
  return (
    <BoardSection
      component="filter-bar"
      title={TEXTS.barTitle}
      note={TEXTS.barNote}
    >
      <BoardState
        state="members"
        label={TEXTS.barStates.members}
        bare
        className="px-2"
      >
        <MembersBar />
      </BoardState>
      <BoardState
        state="menu"
        label={TEXTS.barStates.menu}
        bare
        className="px-2"
      >
        <MenuPillBar />
      </BoardState>
      <BoardState
        state="overflow"
        label={TEXTS.barStates.overflow}
        bare
        className="px-2"
      >
        <FilterBar
          label={TEXTS.barLabel}
          pills={[
            { id: "theme", label: TEXTS.pillTheme, onOpen: () => undefined },
            {
              id: "network",
              label: TEXTS.pillNetwork,
              onOpen: () => undefined,
            },
            {
              id: "language",
              label: TEXTS.pillLanguage,
              onOpen: () => undefined,
            },
            { id: "format", label: TEXTS.pillFormat, onOpen: () => undefined },
            { id: "band", label: TEXTS.pillBand, onOpen: () => undefined },
            {
              id: "country",
              label: TEXTS.pillCountry,
              onToggle: () => undefined,
            },
            {
              id: "available",
              label: TEXTS.pillAvailable,
              onToggle: () => undefined,
            },
          ]}
        />
      </BoardState>
      <BoardState state="bo" label={TEXTS.barStates.bo} bare className="px-2">
        <BackofficeBar />
      </BoardState>
    </BoardSection>
  );
}

function PagerDemo({
  state,
  hasPrevious,
  hasNext,
  summary,
  busy,
  total,
  kind = "pages",
  page,
}: {
  state: string;
  hasPrevious: boolean;
  hasNext: boolean;
  summary: string;
  busy?: boolean;
  total?: string;
  kind?: "pages" | "cursor";
  page?: number;
}) {
  return (
    <Pager
      kind={kind}
      page={page}
      hasPrevious={hasPrevious}
      hasNext={hasNext}
      onPrevious={() => undefined}
      onNext={() => undefined}
      summary={summary}
      total={total}
      busy={busy}
      label={`${TEXTS.pagerLabel} (${state})`}
      previousLabel={TEXTS.previous}
      nextLabel={TEXTS.next}
      className="w-full"
    />
  );
}

function PagerStates() {
  return (
    <BoardSection
      component="pager"
      title={TEXTS.pagerTitle}
      note={TEXTS.pagerNote}
    >
      <BoardState state="pages" label={TEXTS.pagerStates.pages}>
        <PagerDemo
          state="pages"
          page={2}
          hasPrevious
          hasNext
          summary={TEXTS.pageSummary(2, 5)}
        />
      </BoardState>
      <BoardState state="first" label={TEXTS.pagerStates.first}>
        <PagerDemo
          state="first"
          page={1}
          hasPrevious={false}
          hasNext
          summary={TEXTS.pageSummary(1, 5)}
        />
      </BoardState>
      <BoardState state="last" label={TEXTS.pagerStates.last}>
        <PagerDemo
          state="last"
          page={5}
          hasPrevious
          hasNext={false}
          summary={TEXTS.pageSummary(5, 5)}
        />
      </BoardState>
      <BoardState state="cap" label={TEXTS.pagerStates.cap}>
        <PagerDemo
          state="cap"
          page={5}
          hasPrevious
          hasNext={false}
          summary={TEXTS.capSummary}
        />
      </BoardState>
      <BoardState state="busy" label={TEXTS.pagerStates.busy}>
        <PagerDemo
          state="busy"
          page={2}
          hasPrevious
          hasNext
          busy
          summary={TEXTS.pageSummary(2, 5)}
        />
      </BoardState>
      <BoardState state="cursor" label={TEXTS.pagerStates.cursor}>
        <PagerDemo
          state="cursor"
          kind="cursor"
          hasPrevious
          hasNext
          summary={TEXTS.cursorSummary}
          total={TEXTS.total}
        />
      </BoardState>
    </BoardSection>
  );
}

export function DialogBoard() {
  return (
    <>
      <DialogStates />
      <FiltersStates />
      <BarStates />
      <PagerStates />
    </>
  );
}
