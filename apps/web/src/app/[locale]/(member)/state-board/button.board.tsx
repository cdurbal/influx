import { MemberButton } from "@/components/member/ui/MemberButton";
import type {
  MemberButtonSize,
  MemberButtonVariant,
} from "@/components/member/ui/button-classes";
import { BoardSection, BoardState } from "./board-section.board";

const VARIANTS: readonly { variant: MemberButtonVariant; label: string }[] = [
  { variant: "primary", label: "Principal" },
  { variant: "secondary", label: "Secondaire" },
  { variant: "danger", label: "Danger" },
  { variant: "text", label: "Texte" },
];

const SIZES: readonly { size: MemberButtonSize; label: string }[] = [
  { size: "md", label: "Moyen" },
  { size: "lg", label: "Grand" },
];

const TEXTS = {
  title: "Bouton",
  note:
    "Quatre variantes, deux tailles, au repos et indisponible (aria-disabled, jamais disabled). " +
    "Survol, appui et focus sont des états du navigateur : la planche ne les fige pas.",
  rest: "Au repos",
  unavailable: "Indisponible",
} as const;

/** The button of the connected spaces in each of its states of 02c C10 that it has today. */
export function ButtonBoard() {
  return (
    <BoardSection component="button" title={TEXTS.title} note={TEXTS.note}>
      {VARIANTS.map(({ variant, label }) => (
        <BoardState
          key={variant}
          state={variant}
          label={`${label} · ${TEXTS.rest}`}
        >
          {SIZES.map(({ size, label: sizeLabel }) => (
            <MemberButton key={size} variant={variant} size={size}>
              {sizeLabel}
            </MemberButton>
          ))}
        </BoardState>
      ))}
      {VARIANTS.map(({ variant, label }) => (
        <BoardState
          key={variant}
          state={`${variant}-unavailable`}
          label={`${label} · ${TEXTS.unavailable}`}
        >
          <MemberButton variant={variant} aria-disabled="true">
            {TEXTS.unavailable}
          </MemberButton>
        </BoardState>
      ))}
    </BoardSection>
  );
}
