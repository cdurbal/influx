import { ActionLink } from "@/components/member/ui/ActionLink";
import { Button } from "@/components/member/ui/Button";
import type {
  ButtonSize,
  ButtonVariant,
} from "@/components/member/ui/button-classes";
import { PlusIcon } from "@/components/ui/icons";
import { BoardSection, BoardState } from "./board-section.board";

const VARIANTS: readonly { variant: ButtonVariant; label: string }[] = [
  { variant: "primary", label: "Principal" },
  { variant: "secondary", label: "Secondaire" },
  { variant: "danger", label: "Danger" },
  { variant: "text", label: "Texte" },
];

const SIZES: readonly { size: ButtonSize; label: string }[] = [
  { size: "sm", label: "Petit" },
  { size: "bar", label: "Barre" },
  { size: "md", label: "Moyen" },
  { size: "lg", label: "Grand" },
];

const TEXTS = {
  title: "Boutons et liens d'action",
  note:
    "C10 : quatre variantes, quatre tailles (36, 40, 44 et 52 px ; les deux petites ont une zone de toucher de 44 px), " +
    "au repos et indisponible (aria-disabled, jamais disabled), occupé, ajouté, basculé, avec raison, pleine largeur, " +
    "en lien. C11 : le lien d'action, seul sur sa ligne. Survol, appui et focus sont des états du navigateur : la " +
    "planche ne les fige pas.",
  rest: "Au repos",
  unavailable: "Indisponible",
  busy: "Occupé : le libellé change, la largeur ne bouge pas",
  busyAction: "Envoyer",
  busyLabel: "Envoi en cours",
  added: "Ajouté : coche en fondu, contour apaisé",
  addedLabel: "Ajouté",
  addAction: "Ajouter à la sélection",
  pressed: "Basculé : aria-pressed",
  pressedOff: "Filtre inactif",
  pressedOn: "Filtre actif",
  reason: "Indisponible avec sa raison",
  reasonAction: "Continuer",
  reasonText: "Complétez d'abord les champs obligatoires.",
  block: "Pleine largeur",
  blockAction: "Enregistrer",
  asLink: "En lien : même aspect, même taille",
  linkPrimary: "Lien principal",
  linkSecondary: "Lien secondaire",
  withIcon: "Avec icônes",
  iconAction: "Nouvelle campagne",
  linkInline: "Lien d'action",
  linkInlineText: "Revenir à la liste",
  linkGo: "Lien d'action à chevron",
  linkGoText: "Voir le détail",
  linkGoDense: "Voir le détail, dense",
  linkSave: "Lien d'action pour enregistrer",
  saveOff: "Enregistrer pour plus tard",
  saveOn: "Enregistré",
  external: "Lien externe",
  externalText: "Consulter les conditions",
  externalLabel: "(s'ouvre dans un nouvel onglet)",
} as const;

/** The buttons and the links of action of the connected spaces in each of their states (02c C10, C11). */
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
            <Button key={size} variant={variant} size={size}>
              {sizeLabel}
            </Button>
          ))}
        </BoardState>
      ))}
      {VARIANTS.map(({ variant, label }) => (
        <BoardState
          key={variant}
          state={`${variant}-unavailable`}
          label={`${label} · ${TEXTS.unavailable}`}
        >
          <Button variant={variant} aria-disabled="true">
            {TEXTS.unavailable}
          </Button>
        </BoardState>
      ))}
      <BoardState state="busy" label={TEXTS.busy}>
        <Button busy busyLabel={TEXTS.busyLabel}>
          {TEXTS.busyAction}
        </Button>
        <Button busyLabel={TEXTS.busyLabel}>{TEXTS.busyAction}</Button>
      </BoardState>
      <BoardState state="added" label={TEXTS.added}>
        <Button variant="secondary" added>
          {TEXTS.addedLabel}
        </Button>
        <Button variant="secondary">{TEXTS.addAction}</Button>
      </BoardState>
      <BoardState state="pressed" label={TEXTS.pressed}>
        <Button variant="secondary" size="sm" pressed={false}>
          {TEXTS.pressedOff}
        </Button>
        <Button variant="secondary" size="sm" pressed>
          {TEXTS.pressedOn}
        </Button>
      </BoardState>
      <BoardState state="disabled-reason" label={TEXTS.reason}>
        <Button disabledReason="board-button-reason">
          {TEXTS.reasonAction}
        </Button>
        <p id="board-button-reason" className="text-sm text-text-secondary">
          {TEXTS.reasonText}
        </p>
      </BoardState>
      <BoardState state="block" label={TEXTS.block} className="flex-col">
        <Button block>{TEXTS.blockAction}</Button>
      </BoardState>
      <BoardState state="link" label={TEXTS.asLink}>
        <Button href="#board-button">{TEXTS.linkPrimary}</Button>
        <Button href="#board-button" variant="secondary">
          {TEXTS.linkSecondary}
        </Button>
      </BoardState>
      <BoardState state="icons" label={TEXTS.withIcon}>
        <Button icon={<PlusIcon className="size-(--size-icon-sm)" />}>
          {TEXTS.iconAction}
        </Button>
      </BoardState>
      <BoardState
        state="action-link-inline"
        label={TEXTS.linkInline}
        className="flex-col"
      >
        <ActionLink href="#board-button">{TEXTS.linkInlineText}</ActionLink>
      </BoardState>
      <BoardState
        state="action-link-go"
        label={TEXTS.linkGo}
        className="flex-col"
      >
        <ActionLink variant="go" href="#board-button">
          {TEXTS.linkGoText}
        </ActionLink>
        <ActionLink variant="go" dense href="#board-button">
          {TEXTS.linkGoDense}
        </ActionLink>
      </BoardState>
      <BoardState
        state="action-link-save"
        label={TEXTS.linkSave}
        className="flex-col"
      >
        <ActionLink variant="save" pressed={false}>
          {TEXTS.saveOff}
        </ActionLink>
        <ActionLink variant="save" pressed>
          {TEXTS.saveOn}
        </ActionLink>
      </BoardState>
      <BoardState
        state="action-link-external"
        label={TEXTS.external}
        className="flex-col"
      >
        <ActionLink href="#board-button" external={TEXTS.externalLabel}>
          {TEXTS.externalText}
        </ActionLink>
      </BoardState>
    </BoardSection>
  );
}
