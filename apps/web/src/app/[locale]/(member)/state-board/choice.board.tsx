"use client";

import { useState } from "react";
import { Button } from "@/components/member/ui/Button";
import { DateField } from "@/components/member/ui/DateField";
import { Disclosure } from "@/components/member/ui/Disclosure";
import { InternalZone } from "@/components/member/ui/InternalZone";
import { SaveStatus } from "@/components/member/ui/SaveStatus";
import { SegmentedControl } from "@/components/member/ui/SegmentedControl";
import { TagPicker } from "@/components/member/ui/TagPicker";
import { TextField } from "@/components/member/ui/TextField";
import { BoardSection, BoardState } from "./board-section.board";

const TEXTS = {
  segmentedTitle: "Contrôle segmenté",
  segmentedNote:
    "C22 : une piste, des segments de 36 px, le segment actif sur sa surface avec un contour que les couleurs forcées " +
    "dessinent, le compte d'un segment inactif en texte secondaire. Choix (boutons radio natifs : Tab entre au coché, " +
    "les flèches choisissent), onglets (tabulation itinérante : les flèches bouclent et activent, Début et Fin " +
    "atteignent les bouts, deux colonnes sous 640 px) et vues (liens, aucun nav, courante en aria-current vrai).",
  segmentedStates: {
    radio: "Choix : boutons radio",
    counts: "Choix, avec comptes",
    tabs: "Onglets : flèches, Début et Fin",
    views: "Vues : liens",
  },
  radioLabel: "Affichage",
  radioList: "Liste",
  radioGrid: "Grille",
  radioMap: "Carte",
  countsLabel: "État des campagnes",
  active: "En cours",
  archived: "Archivées",
  draft: "Brouillons",
  tabsLabel: "Sections du profil",
  tabIdentity: "Identité",
  tabOffer: "Offre",
  tabPreview: "Aperçu",
  viewsLabel: "Vues de la file",
  viewAll: "Toutes",
  viewMine: "Les miennes",
  viewLate: "En retard",
  pickerTitle: "Sélecteur d'étiquettes",
  pickerNote:
    "C23 : une liste déroulante qui ajoute, des étiquettes de 36 px dont la croix de 24 px a une zone de 44 × 44 px. " +
    "Le retrait est dit dans la zone de statut et le focus passe à la croix de l'étiquette suivante, sinon à la liste. " +
    "Au plafond, plus rien n'est proposé et la zone de statut dit pourquoi.",
  pickerStates: {
    empty: "Vide",
    filled: "Rempli",
    cap: "Plafond atteint",
    error: "Invalide",
  },
  pickerLabel: "Pays de diffusion",
  pickerLimit: "3 pays au plus.",
  pickerLimitReached:
    "Plafond atteint : retirez un pays pour en ajouter un autre.",
  pickerAdd: "Ajouter un pays…",
  pickerList: "Pays choisis",
  pickerError: "Choisissez au moins un pays.",
  france: "France",
  belgium: "Belgique",
  canada: "Canada",
  spain: "Espagne",
  italy: "Italie",
  zoneTitle: "Zone interne",
  zoneNote:
    "C24 : ce que seul INFLUX voit : un cadre en tirets, un titre avec un œil barré, ce que la zone contient. " +
    "Le cadre n'est jamais le seul signe : le titre le dit en mots.",
  zoneState: "Zone interne",
  zoneHeading: "Visible de INFLUX seulement",
  zoneField: "Note du commercial",
  zoneValue: "À rappeler jeudi.",
  saveTitle: "Statut d'enregistrement",
  saveNote:
    "C25 : une icône et une phrase par état, jamais la couleur seule. Seul l'échec est annoncé (une fois, par la " +
    "région de la page) et propose de réessayer ; l'icône d'envoi tourne, et reste fixe sous mouvement réduit.",
  saveStates: {
    idle: "Au repos",
    saving: "Envoi en cours",
    saved: "Enregistré",
    failed: "Échec, avec réessai",
    failing: "L'échec est annoncé une fois, le réessai reprend l'envoi",
  },
  saveBreak: "Provoquer l'échec",
  saveIdle: "Enregistrement automatique",
  saveSaving: "Enregistrement…",
  saveSaved: (time: string) => `Enregistré à ${time}`,
  saveFailed: "Non enregistré : vos modifications sont conservées ici.",
  saveRetry: "Réessayer",
  saveRetryIn: (seconds: number) => `Nouvel essai dans ${seconds} s`,
  saveTime: "14 h 07",
  disclosureTitle: "Pli",
  disclosureNote:
    "C26 : le details natif, un sommaire de 44 px, un chevron qui tourne (un quart, ou un demi-tour pour le panneau " +
    "des gestes rares) et le contenu qui entre en fondu. Six variantes ; une erreur dans un pli fermé l'ouvre.",
  disclosureStates: {
    optional: "Facultatif",
    fold: "Pli",
    danger: "Danger",
    rare: "Gestes rares",
    group: "Groupe, avec compteur",
    change: "Changement",
    forceOpen: "Une erreur dans un pli fermé l'ouvre",
  },
  optionalSummary: "Facultatif, à compléter plus tard",
  foldSummary: "Plus de critères",
  dangerSummary: "Supprimer cette campagne",
  rareSummary: "Autres actions",
  groupSummary: "Documents joints",
  changeSummary: "Voir le changement",
  panelText: "Le contenu du pli.",
  dangerText: "Cette action est définitive.",
  forceSummary: "Informations complémentaires",
  forceLabel: "Site web",
  forceError: "Ce champ est obligatoire.",
  forceAction: "Provoquer l'erreur",
  rareAction: "Dupliquer",
  rareOther: "Archiver",
  dateTitle: "Champ de date",
  dateNote:
    "C47 : un champ texte de 12 rem sans sélecteur natif ; le jour, le mois puis l'année pour fr et en, le mois puis " +
    "le jour pour en-US seul ; les séparateurs / . - ou huit chiffres ; la mise en forme au départ du champ. Un texte " +
    "qui n'est pas une date est refusé en toutes lettres ; l'ordre des dates est dit sous la plus tardive.",
  dateStates: {
    empty: "Vide",
    valid: "Valide",
    error: "Erreur de l'écran",
    orderError: "Ordre refusé : erreur",
    orderWarning: "Ordre à vérifier : avertissement",
    us: "Mois d'abord (en-US)",
    locked: "Verrouillé",
  },
  dateLabel: "Début de la campagne",
  dateEnd: "Fin de la campagne",
  dateHelp: "jj/mm/aaaa, par exemple 15/01/2027.",
  dateFormatError: "Écrivez la date sous la forme jj/mm/aaaa.",
  dateRangeError: "Choisissez une date à partir du 01/01/2027.",
  dateRequired: "Ce champ est obligatoire.",
  dateOrderNote: "La fin est avant le début : 15/01/2027.",
  dateOrderWarning: "À vérifier : la fin est très proche du début.",
  dateStart: "2027-01-15",
  dateMin: "2027-01-01",
} as const;

type SegmentedDemoProps = {
  label: string;
  options: readonly { value: string; label: string; count?: number }[];
  initial: string;
  kind: "radio" | "tabs";
  controls?: boolean;
};

/** A radio or tab control that holds its own choice: the board holds no data. */
function SegmentedDemo({
  label,
  options,
  initial,
  kind,
  controls = false,
}: SegmentedDemoProps) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <SegmentedControl
        kind={kind}
        label={label}
        value={value}
        onChange={setValue}
        options={options.map((option) => ({
          ...option,
          controls: controls ? `board-tab-panel-${option.value}` : undefined,
        }))}
      />
      {controls
        ? options.map((option) => (
            <p
              key={option.value}
              id={`board-tab-panel-${option.value}`}
              role="tabpanel"
              aria-label={option.label}
              hidden={option.value !== value}
              className="w-full text-sm text-text-secondary"
            >
              {option.label}
            </p>
          ))
        : null}
    </>
  );
}

function SegmentedStates() {
  return (
    <BoardSection
      component="segmented-control"
      title={TEXTS.segmentedTitle}
      note={TEXTS.segmentedNote}
    >
      <BoardState state="radio" label={TEXTS.segmentedStates.radio}>
        <SegmentedDemo
          kind="radio"
          label={TEXTS.radioLabel}
          initial="list"
          options={[
            { value: "list", label: TEXTS.radioList },
            { value: "grid", label: TEXTS.radioGrid },
            { value: "map", label: TEXTS.radioMap },
          ]}
        />
      </BoardState>
      <BoardState state="counts" label={TEXTS.segmentedStates.counts}>
        <SegmentedDemo
          kind="radio"
          label={TEXTS.countsLabel}
          initial="active"
          options={[
            { value: "active", label: TEXTS.active, count: 12 },
            { value: "archived", label: TEXTS.archived, count: 4 },
            { value: "draft", label: TEXTS.draft, count: 2 },
          ]}
        />
      </BoardState>
      <BoardState state="tabs" label={TEXTS.segmentedStates.tabs}>
        <SegmentedDemo
          kind="tabs"
          label={TEXTS.tabsLabel}
          initial="identity"
          controls
          options={[
            { value: "identity", label: TEXTS.tabIdentity },
            { value: "offer", label: TEXTS.tabOffer },
            { value: "preview", label: TEXTS.tabPreview },
          ]}
        />
      </BoardState>
      <BoardState state="views" label={TEXTS.segmentedStates.views}>
        <SegmentedControl
          kind="views"
          label={TEXTS.viewsLabel}
          value="mine"
          options={[
            {
              value: "all",
              label: TEXTS.viewAll,
              count: 18,
              href: "#board-views-all",
            },
            {
              value: "mine",
              label: TEXTS.viewMine,
              count: 6,
              href: "#board-views-mine",
            },
            {
              value: "late",
              label: TEXTS.viewLate,
              count: 2,
              href: "#board-views-late",
            },
          ]}
        />
      </BoardState>
    </BoardSection>
  );
}

const COUNTRIES = [
  { code: "fr", label: TEXTS.france },
  { code: "be", label: TEXTS.belgium },
  { code: "ca", label: TEXTS.canada },
  { code: "es", label: TEXTS.spain },
  { code: "it", label: TEXTS.italy },
];

type PickerDemoProps = {
  id: string;
  initial: readonly string[];
  error?: string;
};

function PickerDemo({ id, initial, error }: PickerDemoProps) {
  const [value, setValue] = useState<readonly string[]>(initial);
  return (
    <TagPicker
      id={id}
      name={id}
      label={TEXTS.pickerLabel}
      options={COUNTRIES}
      value={value}
      onChange={setValue}
      max={3}
      limitText={TEXTS.pickerLimit}
      countText={`${value.length} / 3`}
      limitReachedText={TEXTS.pickerLimitReached}
      addLabel={TEXTS.pickerAdd}
      listLabel={TEXTS.pickerList}
      removeLabel={(label) => `Retirer ${label}`}
      removedText={(label) => `${label} retiré`}
      error={error}
      className="w-full"
    />
  );
}

function PickerStates() {
  return (
    <BoardSection
      component="tag-picker"
      title={TEXTS.pickerTitle}
      note={TEXTS.pickerNote}
    >
      <BoardState state="empty" label={TEXTS.pickerStates.empty}>
        <PickerDemo id="board-picker-empty" initial={[]} />
      </BoardState>
      <BoardState state="filled" label={TEXTS.pickerStates.filled}>
        <PickerDemo id="board-picker-filled" initial={["fr", "be"]} />
      </BoardState>
      <BoardState state="cap" label={TEXTS.pickerStates.cap}>
        <PickerDemo id="board-picker-cap" initial={["fr", "be", "ca"]} />
      </BoardState>
      <BoardState state="error" label={TEXTS.pickerStates.error}>
        <PickerDemo
          id="board-picker-error"
          initial={[]}
          error={TEXTS.pickerError}
        />
      </BoardState>
    </BoardSection>
  );
}

function ZoneStates() {
  return (
    <BoardSection
      component="internal-zone"
      title={TEXTS.zoneTitle}
      note={TEXTS.zoneNote}
    >
      <BoardState state="zone" label={TEXTS.zoneState}>
        <InternalZone title={TEXTS.zoneHeading} className="w-full">
          <TextField
            id="board-zone-note"
            name="board-zone-note"
            label={TEXTS.zoneField}
            value={TEXTS.zoneValue}
            onChange={() => undefined}
            maxLength={120}
          />
        </InternalZone>
      </BoardState>
    </BoardSection>
  );
}

type SaveDemoProps = {
  state: "idle" | "saving" | "saved" | "failed";
};

function SaveDemo({ state }: SaveDemoProps) {
  return (
    <SaveStatus
      state={state}
      savedAt={TEXTS.saveTime}
      retryInSeconds={5}
      onRetry={() => undefined}
      idleText={TEXTS.saveIdle}
      savingText={TEXTS.saveSaving}
      savedText={TEXTS.saveSaved}
      failedText={TEXTS.saveFailed}
      retryInText={TEXTS.saveRetryIn}
      retryLabel={TEXTS.saveRetry}
    />
  );
}

/** A save that fails when the button says so, so that the announcement is seen once, when the failure comes. */
function FailingSave() {
  const [state, setState] = useState<"saving" | "failed">("saving");
  return (
    <>
      <SaveStatus
        state={state}
        retryInSeconds={5}
        onRetry={() => setState("saving")}
        idleText={TEXTS.saveIdle}
        savingText={TEXTS.saveSaving}
        savedText={TEXTS.saveSaved}
        failedText={TEXTS.saveFailed}
        retryInText={TEXTS.saveRetryIn}
        retryLabel={TEXTS.saveRetry}
      />
      <Button variant="secondary" size="sm" onClick={() => setState("failed")}>
        {TEXTS.saveBreak}
      </Button>
    </>
  );
}

function SaveStates() {
  return (
    <BoardSection
      component="save-status"
      title={TEXTS.saveTitle}
      note={TEXTS.saveNote}
    >
      <BoardState state="idle" label={TEXTS.saveStates.idle}>
        <SaveDemo state="idle" />
      </BoardState>
      <BoardState state="saving" label={TEXTS.saveStates.saving}>
        <SaveDemo state="saving" />
      </BoardState>
      <BoardState state="saved" label={TEXTS.saveStates.saved}>
        <SaveDemo state="saved" />
      </BoardState>
      <BoardState state="failed" label={TEXTS.saveStates.failed}>
        <SaveDemo state="failed" />
      </BoardState>
      <BoardState state="failing" label={TEXTS.saveStates.failing}>
        <FailingSave />
      </BoardState>
    </BoardSection>
  );
}

/** A fold whose field fails: the button raises the error, and the closed fold opens by itself. */
function ForceOpenDemo() {
  const [failed, setFailed] = useState(false);
  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setFailed(true)}>
        {TEXTS.forceAction}
      </Button>
      <Disclosure
        variant="fold"
        summary={TEXTS.forceSummary}
        forceOpen={failed}
        className="w-full"
      >
        <TextField
          id="board-disclosure-force"
          name="board-disclosure-force"
          label={TEXTS.forceLabel}
          value=""
          onChange={() => undefined}
          maxLength={120}
          error={failed ? TEXTS.forceError : null}
        />
      </Disclosure>
    </>
  );
}

function DisclosureStates() {
  const states = TEXTS.disclosureStates;
  return (
    <BoardSection
      component="disclosure"
      title={TEXTS.disclosureTitle}
      note={TEXTS.disclosureNote}
    >
      <BoardState state="optional" label={states.optional}>
        <Disclosure
          variant="optional"
          summary={TEXTS.optionalSummary}
          className="w-full"
        >
          <p className="text-sm text-text-secondary">{TEXTS.panelText}</p>
        </Disclosure>
      </BoardState>
      <BoardState state="fold" label={states.fold}>
        <Disclosure
          variant="fold"
          summary={TEXTS.foldSummary}
          className="w-full"
        >
          <p className="text-sm text-text-secondary">{TEXTS.panelText}</p>
        </Disclosure>
      </BoardState>
      <BoardState state="danger" label={states.danger}>
        <Disclosure
          variant="danger"
          summary={TEXTS.dangerSummary}
          className="w-full"
        >
          <p className="text-sm text-text-secondary">{TEXTS.dangerText}</p>
        </Disclosure>
      </BoardState>
      <BoardState state="rare" label={states.rare}>
        <Disclosure
          variant="rare"
          summary={TEXTS.rareSummary}
          className="w-full"
        >
          <Button variant="secondary" size="sm">
            {TEXTS.rareAction}
          </Button>
          <Button variant="secondary" size="sm">
            {TEXTS.rareOther}
          </Button>
        </Disclosure>
      </BoardState>
      <BoardState state="group" label={states.group}>
        <Disclosure
          variant="group"
          summary={TEXTS.groupSummary}
          count={3}
          defaultOpen
          className="w-full"
        >
          <p className="text-sm text-text-secondary">{TEXTS.panelText}</p>
        </Disclosure>
      </BoardState>
      <BoardState state="change" label={states.change}>
        <Disclosure
          variant="change"
          summary={TEXTS.changeSummary}
          className="w-full"
        >
          <p className="text-sm text-text-secondary">{TEXTS.panelText}</p>
        </Disclosure>
      </BoardState>
      <BoardState state="force-open" label={states.forceOpen}>
        <ForceOpenDemo />
      </BoardState>
    </BoardSection>
  );
}

type DateDemoProps = {
  id: string;
  initial: string | null;
  locale?: string;
  label?: string;
  error?: string;
  orderNote?: string;
  orderKind?: "error" | "warning";
  disabled?: boolean;
};

/** A date that holds its own value: the board holds no data; the bounds make a range to refuse. */
function DateDemo({
  id,
  initial,
  locale = "fr",
  label = TEXTS.dateLabel,
  error,
  orderNote,
  orderKind,
  disabled,
}: DateDemoProps) {
  const [value, setValue] = useState<string | null>(initial);
  return (
    <DateField
      id={id}
      name={id}
      label={label}
      requiredLabel="obligatoire"
      help={TEXTS.dateHelp}
      value={value}
      onChange={setValue}
      locale={locale}
      min={TEXTS.dateMin}
      formatError={TEXTS.dateFormatError}
      rangeError={TEXTS.dateRangeError}
      error={error}
      orderNote={orderNote}
      orderKind={orderKind}
      disabled={disabled}
      className="w-full"
    />
  );
}

function DateStates() {
  const states = TEXTS.dateStates;
  return (
    <BoardSection
      component="date-field"
      title={TEXTS.dateTitle}
      note={TEXTS.dateNote}
    >
      <BoardState state="empty" label={states.empty}>
        <DateDemo id="board-date-empty" initial={null} />
      </BoardState>
      <BoardState state="valid" label={states.valid}>
        <DateDemo id="board-date-valid" initial={TEXTS.dateStart} />
      </BoardState>
      <BoardState state="error" label={states.error}>
        <DateDemo
          id="board-date-error"
          initial={null}
          error={TEXTS.dateRequired}
        />
      </BoardState>
      <BoardState state="order-error" label={states.orderError}>
        <DateDemo
          id="board-date-order-error"
          initial={TEXTS.dateStart}
          label={TEXTS.dateEnd}
          orderNote={TEXTS.dateOrderNote}
          orderKind="error"
        />
      </BoardState>
      <BoardState state="order-warning" label={states.orderWarning}>
        <DateDemo
          id="board-date-order-warning"
          initial={TEXTS.dateStart}
          label={TEXTS.dateEnd}
          orderNote={TEXTS.dateOrderWarning}
          orderKind="warning"
        />
      </BoardState>
      <BoardState state="us" label={states.us}>
        <DateDemo id="board-date-us" initial={TEXTS.dateStart} locale="en-US" />
      </BoardState>
      <BoardState state="locked" label={states.locked}>
        <DateDemo id="board-date-locked" initial={TEXTS.dateStart} disabled />
      </BoardState>
    </BoardSection>
  );
}

/** The choices, the disclosure and the save status (C22 to C26, C47): their states on the board. */
export function ChoiceBoard() {
  return (
    <>
      <SegmentedStates />
      <PickerStates />
      <ZoneStates />
      <SaveStates />
      <DisclosureStates />
      <DateStates />
    </>
  );
}
