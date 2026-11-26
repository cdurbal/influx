"use client";

import { useState } from "react";
import {
  ChoiceGroup,
  type ChoiceGroupOption,
} from "@/components/member/ui/ChoiceGroup";
import { ErrorSummary, MissingList } from "@/components/member/ui/ErrorSummary";
import {
  FieldGrid,
  type FieldLayout,
  type FieldTexts,
} from "@/components/member/ui/Field";
import { FieldMessage } from "@/components/member/ui/FieldMessage";
import { TextAreaField } from "@/components/member/ui/TextAreaField";
import { TextField } from "@/components/member/ui/TextField";
import { BoardSection, BoardState } from "./board-section.board";

const MAX_LENGTH = 80;
const AREA_MAX_LENGTH = 400;

const TEXTS = {
  title: "Champ",
  note:
    "C18 : le champ d'une ligne dans ses états : vide, rempli, avec couche et aide, en avertissement, en erreur, " +
    "désactivé (verrouillé : sa valeur reste lisible), avec unité, avec compteur, sans badge de couche, conditionnel. " +
    "L'erreur est un contour de 2 px sans décalage du texte ; seule la couleur du contour transitionne. " +
    "La grille de champs passe de une à quatre colonnes dès 640 px.",
  label: "Nom de la marque",
  required: "obligatoire",
  filled: "Atelier Lumière",
  help: "Le nom tel qu'il apparaît sur votre site.",
  layer: "Visible de votre commercial",
  warning: "À vérifier : ce nom ressemble à celui d'une autre marque.",
  error: "Ce champ est obligatoire.",
  states: {
    empty: "Vide",
    filled: "Rempli",
    help: "Avec couche et aide",
    warning: "Avertissement",
    error: "Erreur",
    errorFilled: "Erreur, champ rempli (le texte ne bouge pas)",
    disabled: "Désactivé ou verrouillé (lecture seule)",
    unit: "Largeur d'un nombre, avec unité",
    width: "Largeur par ligne : petite",
    area: "Zone de texte, avec compteur",
    areaError: "Zone de texte, en erreur",
    layerHidden: "Couche dite ailleurs : pas de badge",
    conditional: "Champ conditionnel : entre par rise-in",
    grid: "Grille de champs : quatre colonnes dès 640 px",
  },
  days: "jours",
  durationValue: "14",
  durationLabel: "Durée de la mission",
  areaLabel: "Présentation de la marque",
  areaValue: "Une maison d'ateliers qui crée des coffrets.",
  conditionalLabel: "Valeur estimée du produit",
  gridLabels: ["Prénom", "Nom", "Ville", "Pays"],
  gridValues: ["Camille", "Durand", "Lyon", "France"],
  messageTitle: "Message de champ",
  messageNote:
    "C19 : l'icône de son genre et le texte, sans boîte ni fond ; l'erreur est en 600. Un avertissement dit lui-même " +
    "« À vérifier : » ; « Vu par » est ce que voit une marque. Le message n'est jamais annoncé de lui-même : le champ y est relié.",
  messageStates: {
    error: "Erreur",
    warning: "Avertissement",
    seen: "Vu par une marque",
  },
  messageError: "Indiquez le nom de votre marque.",
  messageWarning: "À vérifier : ce nom est déjà utilisé.",
  messageSeen: "Votre commercial voit ce champ.",
  summaryTitle: "Résumé des erreurs",
  summaryNote:
    "C20 : le résumé d'un formulaire refusé : un contour, un titre, un lien par champ ; le lien ouvre ce qui cache le champ " +
    "puis le focalise. Absent quand il n'y a aucune erreur. La liste des manques est une ligne d'alerte par élément.",
  summaryStates: {
    summary: "Résumé : le premier lien ouvre le champ caché",
    empty: "Sans erreur : rien n'est affiché",
    missing: "Liste des manques",
  },
  summaryHeading: "2 champs demandent votre attention",
  summaryHidden: "Site web",
  summaryHiddenReason: "Ce champ est obligatoire.",
  summaryVisible: "Nom de la marque",
  summaryVisibleReason: "Le nom est trop court.",
  summaryShort: "At",
  summaryOpen: "Étape 2 : ouverte, le champ est affiché.",
  summaryClosed: "Étape 2 : fermée, le champ est caché.",
  summaryNoError: "Aucune erreur : le résumé est absent.",
  missingAction: "Compléter",
  missingFirst: "Photo du logo",
  missingSecond: "Secteur d'activité",
  choiceTitle: "Groupe de choix",
  choiceNote:
    "C21 : un fieldset et sa légende, une ligne de 44 px par choix dont tout le libellé est la zone de clic. Un geste " +
    "n'appelle que onChange. Au plafond, les autres cases sont indisponibles mais restent dans l'ordre de tabulation, et " +
    "le plafond est dit en zone de statut ; un choix désactivé dit pourquoi.",
  choiceStates: {
    boxes: "Cases, plafond de 3",
    cap: "Plafond atteint",
    radios: "Boutons radio, avec aide par choix",
    reason: "Choix désactivé, expliqué",
    invalid: "Groupe invalide",
    locked: "Groupe verrouillé",
    yesNo: "Oui ou non",
  },
  topicsLabel: "Thématiques",
  topicsLimit: "3 au plus.",
  topicsLimitReached:
    "Plafond atteint : décochez un choix pour en prendre un autre.",
  sizeLabel: "Taille de l'équipe",
  formatLabel: "Formats proposés",
  reasonLabel: "Livraison",
  invalidError: "Choisissez au moins une thématique.",
  yesNoLabel: "Acceptez-vous les produits en échange ?",
  yes: "Oui",
  no: "Non",
} as const;

type BoardFieldProps = {
  id: string;
  initial: string;
  texts: FieldTexts & FieldLayout;
  disabled?: boolean;
};

/** A field with a value of its own: the board holds no data, only what the cell shows. */
function BoardField({ id, initial, texts, disabled }: BoardFieldProps) {
  const [value, setValue] = useState(initial);
  return (
    <TextField
      {...texts}
      id={id}
      name={id}
      value={value}
      onChange={setValue}
      maxLength={MAX_LENGTH}
      disabled={disabled}
      className="w-full"
    />
  );
}

type BoardAreaProps = {
  id: string;
  texts: FieldTexts;
};

function BoardArea({ id, texts }: BoardAreaProps) {
  const [value, setValue] = useState<string>(TEXTS.areaValue);
  return (
    <TextAreaField
      {...texts}
      id={id}
      name={id}
      value={value}
      onChange={setValue}
      maxLength={AREA_MAX_LENGTH}
      counterText={(count, max) => `${count} / ${max} caractères`}
      className="w-full"
    />
  );
}

const BASE: FieldTexts = { label: TEXTS.label, requiredLabel: TEXTS.required };

const TOPICS: readonly ChoiceGroupOption[] = [
  { code: "beauty", label: "Beauté" },
  { code: "food", label: "Cuisine" },
  { code: "travel", label: "Voyage" },
  { code: "sport", label: "Sport" },
];

const SIZES: readonly ChoiceGroupOption[] = [
  { code: "solo", label: "Une personne", help: "Vous gérez tout seul." },
  { code: "small", label: "De 2 à 10", help: "Une petite équipe." },
  { code: "large", label: "Plus de 10", help: "Plusieurs services." },
];

const FORMATS: readonly ChoiceGroupOption[] = [
  { code: "video", label: "Vidéo" },
  {
    code: "live",
    label: "Direct",
    disabled: true,
    reason: "Les directs ne sont pas ouverts dans votre pays.",
  },
  { code: "photo", label: "Photo" },
];

const YES_NO: readonly ChoiceGroupOption[] = [
  { code: "yes", label: TEXTS.yes },
  { code: "no", label: TEXTS.no },
];

/** The one-line field of the connected spaces in its states (02c C18), with its unit, its counter and its grid. */
function FieldStates() {
  return (
    <BoardSection component="field" title={TEXTS.title} note={TEXTS.note}>
      <BoardState state="empty" label={TEXTS.states.empty}>
        <BoardField id="board-field-empty" initial="" texts={BASE} />
      </BoardState>
      <BoardState state="filled" label={TEXTS.states.filled}>
        <BoardField
          id="board-field-filled"
          initial={TEXTS.filled}
          texts={BASE}
        />
      </BoardState>
      <BoardState state="help" label={TEXTS.states.help}>
        <BoardField
          id="board-field-help"
          initial={TEXTS.filled}
          texts={{
            ...BASE,
            help: TEXTS.help,
            layer: { layer: "revealed", label: TEXTS.layer },
          }}
        />
      </BoardState>
      <BoardState state="warning" label={TEXTS.states.warning}>
        <BoardField
          id="board-field-warning"
          initial={TEXTS.filled}
          texts={{ ...BASE, warnings: [TEXTS.warning] }}
        />
      </BoardState>
      <BoardState state="error" label={TEXTS.states.error}>
        <BoardField
          id="board-field-error"
          initial=""
          texts={{ ...BASE, error: TEXTS.error }}
        />
      </BoardState>
      <BoardState state="error-filled" label={TEXTS.states.errorFilled}>
        <BoardField
          id="board-field-error-filled"
          initial={TEXTS.filled}
          texts={{ ...BASE, error: TEXTS.error }}
        />
      </BoardState>
      <BoardState state="disabled" label={TEXTS.states.disabled}>
        <BoardField
          id="board-field-disabled"
          initial={TEXTS.filled}
          texts={BASE}
          disabled
        />
      </BoardState>
      <BoardState state="unit" label={TEXTS.states.unit}>
        <BoardField
          id="board-field-unit"
          initial={TEXTS.durationValue}
          texts={{
            label: TEXTS.durationLabel,
            width: "number",
            suffix: TEXTS.days,
          }}
        />
      </BoardState>
      <BoardState state="width" label={TEXTS.states.width}>
        <BoardField
          id="board-field-width"
          initial={TEXTS.filled}
          texts={{ ...BASE, width: "sm" }}
        />
      </BoardState>
      <BoardState state="area" label={TEXTS.states.area}>
        <BoardArea
          id="board-field-area"
          texts={{ label: TEXTS.areaLabel, help: TEXTS.help }}
        />
      </BoardState>
      <BoardState state="area-error" label={TEXTS.states.areaError}>
        <BoardArea
          id="board-field-area-error"
          texts={{ label: TEXTS.areaLabel, error: TEXTS.error }}
        />
      </BoardState>
      <BoardState state="layer-hidden" label={TEXTS.states.layerHidden}>
        <BoardField
          id="board-field-layer-hidden"
          initial={TEXTS.filled}
          texts={{
            ...BASE,
            layer: { layer: "public", label: TEXTS.layer },
            layerShown: false,
          }}
        />
      </BoardState>
      <BoardState state="conditional" label={TEXTS.states.conditional}>
        <BoardField
          id="board-field-conditional"
          initial=""
          texts={{ label: TEXTS.conditionalLabel, conditional: true }}
        />
      </BoardState>
      <BoardState state="grid" label={TEXTS.states.grid}>
        <FieldGrid columns={4} className="w-full">
          {TEXTS.gridLabels.map((label, index) => (
            <BoardField
              key={label}
              id={`board-field-grid-${index}`}
              initial={TEXTS.gridValues[index] ?? ""}
              texts={{ label }}
            />
          ))}
        </FieldGrid>
      </BoardState>
    </BoardSection>
  );
}

function MessageStates() {
  return (
    <BoardSection
      component="field-message"
      title={TEXTS.messageTitle}
      note={TEXTS.messageNote}
    >
      <BoardState state="error" label={TEXTS.messageStates.error}>
        <FieldMessage kind="error">{TEXTS.messageError}</FieldMessage>
      </BoardState>
      <BoardState state="warning" label={TEXTS.messageStates.warning}>
        <FieldMessage kind="warning">{TEXTS.messageWarning}</FieldMessage>
      </BoardState>
      <BoardState state="seen" label={TEXTS.messageStates.seen}>
        <FieldMessage kind="seen">{TEXTS.messageSeen}</FieldMessage>
      </BoardState>
    </BoardSection>
  );
}

/** The summary whose first link opens the field that a closed step hides (`reveal`), then focuses it. */
function SummaryDemo() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <ErrorSummary
        id="board-summary"
        title={TEXTS.summaryHeading}
        items={[
          {
            fieldId: "board-summary-hidden",
            label: TEXTS.summaryHidden,
            reason: TEXTS.summaryHiddenReason,
            reveal: () => setOpen(true),
          },
          {
            fieldId: "board-summary-visible",
            label: TEXTS.summaryVisible,
            reason: TEXTS.summaryVisibleReason,
          },
        ]}
      />
      <p className="w-full text-sm text-text-secondary">
        {open ? TEXTS.summaryOpen : TEXTS.summaryClosed}
      </p>
      {open ? (
        <BoardField
          id="board-summary-hidden"
          initial=""
          texts={{
            label: TEXTS.summaryHidden,
            error: TEXTS.summaryHiddenReason,
          }}
        />
      ) : null}
      <BoardField
        id="board-summary-visible"
        initial={TEXTS.summaryShort}
        texts={{
          label: TEXTS.summaryVisible,
          error: TEXTS.summaryVisibleReason,
        }}
      />
    </>
  );
}

function SummaryStates() {
  return (
    <BoardSection
      component="error-summary"
      title={TEXTS.summaryTitle}
      note={TEXTS.summaryNote}
    >
      <BoardState
        state="summary"
        label={TEXTS.summaryStates.summary}
        className="flex-col"
      >
        <SummaryDemo />
      </BoardState>
      <BoardState state="empty" label={TEXTS.summaryStates.empty}>
        <ErrorSummary title={TEXTS.summaryHeading} items={[]} />
        <p className="text-sm text-text-secondary">{TEXTS.summaryNoError}</p>
      </BoardState>
      <BoardState state="missing" label={TEXTS.summaryStates.missing}>
        <MissingList
          actionLabel={TEXTS.missingAction}
          items={[
            { id: "logo", label: TEXTS.missingFirst, href: "#board-summary" },
            {
              id: "sector",
              label: TEXTS.missingSecond,
              href: "#board-summary",
            },
          ]}
        />
      </BoardState>
    </BoardSection>
  );
}

type BoxesProps = {
  id: string;
  label: string;
  initial: readonly string[];
  error?: string;
  options?: readonly ChoiceGroupOption[];
};

/** A group of boxes with a cap of three, its count and its status, holding its own answer. */
function Boxes({ id, label, initial, error, options = TOPICS }: BoxesProps) {
  const [value, setValue] = useState<readonly string[]>(initial);
  return (
    <ChoiceGroup
      type="checkbox"
      id={id}
      label={label}
      requiredLabel={TEXTS.required}
      options={options}
      value={value}
      onChange={setValue}
      max={3}
      limitText={TEXTS.topicsLimit}
      countText={`${value.length} / 3`}
      limitReachedText={TEXTS.topicsLimitReached}
      error={error}
      className="w-full"
    />
  );
}

type RadiosProps = {
  id: string;
  label: string;
  options: readonly ChoiceGroupOption[];
  initial: string | null;
  disabled?: boolean;
};

function Radios({ id, label, options, initial, disabled }: RadiosProps) {
  const [value, setValue] = useState<string | null>(initial);
  return (
    <ChoiceGroup
      type="radio"
      id={id}
      name={id}
      label={label}
      options={options}
      value={value}
      onChange={setValue}
      disabled={disabled}
      className="w-full"
    />
  );
}

function ChoiceStates() {
  return (
    <BoardSection
      component="choice-group"
      title={TEXTS.choiceTitle}
      note={TEXTS.choiceNote}
    >
      <BoardState state="boxes" label={TEXTS.choiceStates.boxes}>
        <Boxes
          id="board-choice-boxes"
          label={TEXTS.topicsLabel}
          initial={["beauty"]}
        />
      </BoardState>
      <BoardState state="cap" label={TEXTS.choiceStates.cap}>
        <Boxes
          id="board-choice-cap"
          label={TEXTS.topicsLabel}
          initial={["beauty", "food", "travel"]}
        />
      </BoardState>
      <BoardState state="radios" label={TEXTS.choiceStates.radios}>
        <Radios
          id="board-choice-radios"
          label={TEXTS.sizeLabel}
          options={SIZES}
          initial="small"
        />
      </BoardState>
      <BoardState state="reason" label={TEXTS.choiceStates.reason}>
        <Boxes
          id="board-choice-reason"
          label={TEXTS.formatLabel}
          initial={["video"]}
          options={FORMATS}
        />
      </BoardState>
      <BoardState state="invalid" label={TEXTS.choiceStates.invalid}>
        <Boxes
          id="board-choice-invalid"
          label={TEXTS.topicsLabel}
          initial={[]}
          error={TEXTS.invalidError}
        />
      </BoardState>
      <BoardState state="locked" label={TEXTS.choiceStates.locked}>
        <Radios
          id="board-choice-locked"
          label={TEXTS.reasonLabel}
          options={YES_NO}
          initial="yes"
          disabled
        />
      </BoardState>
      <BoardState state="yes-no" label={TEXTS.choiceStates.yesNo}>
        <Radios
          id="board-choice-yes-no"
          label={TEXTS.yesNoLabel}
          options={YES_NO}
          initial={null}
        />
      </BoardState>
    </BoardSection>
  );
}

/** The fields and their messages (C18 to C21): the field in its states, its message, the summary and the group of choices. */
export function FieldBoard() {
  return (
    <>
      <FieldStates />
      <MessageStates />
      <SummaryStates />
      <ChoiceStates />
    </>
  );
}
