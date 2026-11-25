"use client";

import { useState } from "react";
import { TextField } from "@/components/member/ui/TextField";
import type { FieldTexts } from "@/components/member/ui/FieldFrame";
import { BoardSection, BoardState } from "./board-section.board";

const MAX_LENGTH = 80;

const TEXTS = {
  title: "Champ",
  note:
    "Le champ d'une ligne dans ses états d'aujourd'hui : vide, rempli, avec couche et aide, " +
    "en avertissement, en erreur (aria-invalid, le message relié au champ) et désactivé. " +
    "Les états de lecture seule et de compteur viennent avec le composant de RUB.",
  label: "Nom de la marque",
  required: "obligatoire",
  filled: "Atelier Lumière",
  help: "Le nom tel qu'il apparaît sur votre site.",
  layer: "Visible de votre commercial",
  warning: "Ce nom ressemble à celui d'une autre marque : vérifiez-le.",
  error: "Ce champ est obligatoire.",
  states: {
    empty: "Vide",
    filled: "Rempli",
    help: "Avec couche et aide",
    warning: "Avertissement",
    error: "Erreur",
    disabled: "Désactivé",
  },
} as const;

type BoardFieldProps = {
  id: string;
  initial: string;
  texts: FieldTexts;
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

const BASE: FieldTexts = { label: TEXTS.label, requiredLabel: TEXTS.required };

/** The one-line field of the connected spaces in the states it has today (02c C18). */
export function FieldBoard() {
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
      <BoardState state="disabled" label={TEXTS.states.disabled}>
        <BoardField
          id="board-field-disabled"
          initial={TEXTS.filled}
          texts={BASE}
          disabled
        />
      </BoardState>
    </BoardSection>
  );
}
