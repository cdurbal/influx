import { Button } from "@/components/member/ui/Button";
import { Card } from "@/components/member/ui/Card";
import { CardActions } from "@/components/member/ui/CardActions";
import { CARD_TITLE } from "@/components/member/ui/heading-classes";
import { InnerPanel } from "@/components/member/ui/InnerPanel";
import { InfoIcon } from "@/components/ui/icons";
import { BoardSection, BoardState } from "./board-section.board";

const TEXTS = {
  title: "Cartes, panneaux et actions de carte",
  note:
    "C04 : la carte et ses trois autres formes ; la carte à lien est une seule cible, étirée sur toute la carte. " +
    "C05 : le panneau intérieur, sur la surface d'une carte, jamais dans un autre panneau. C12 : la rangée d'actions " +
    "d'une carte, pleine largeur sous 480 px quand on le demande. Chaque cellule est posée sur la page : une carte " +
    "ne se met jamais dans une autre.",
  cardDefault: "Carte, par défaut (32 px, 24 sur téléphone)",
  cardCompact: "Carte compacte (16 px)",
  cardBox: "Carte encadrée (24 px)",
  cardLink: "Carte à lien : un seul lien, étiré",
  cardTitle: "Titre de la carte",
  cardText: "Le contenu de la carte se place sous son titre.",
  linkTitle: "Campagne de printemps",
  linkText: "Toute la carte mène à la campagne.",
  panelDefault: "Panneau intérieur, par défaut",
  panelReadonly: "Panneau intérieur, ligne en lecture seule",
  panelPreview: "Panneau intérieur, aperçu",
  panelForm: "Panneau intérieur, formulaire (backoffice)",
  panelTitle: "Titre du panneau",
  panelText: "Le contenu du panneau se place sous son titre.",
  readonlyLabel: "Adresse de contact",
  readonlyValue: "contact@example.test",
  readonlyAction: "Modifier",
  previewCap: "Aperçu",
  previewText: "Voici ce que verra l'autre partie.",
  actions: "Actions de carte",
  actionsStretch: "Actions de carte, pleine largeur sous 480 px",
  principal: "Enregistrer",
  secondary: "Annuler",
} as const;

/** The surfaces and the actions of the member spaces (02c C04, C05, C12), each state standing on the page. */
export function SurfaceBoard() {
  return (
    <BoardSection component="surface" title={TEXTS.title} note={TEXTS.note}>
      <BoardState state="card-default" label={TEXTS.cardDefault} bare>
        <Card>
          <p className={CARD_TITLE}>{TEXTS.cardTitle}</p>
          <p className="text-md text-text-secondary">{TEXTS.cardText}</p>
        </Card>
      </BoardState>
      <BoardState state="card-compact" label={TEXTS.cardCompact} bare>
        <Card variant="compact">
          <p className="text-md text-text-secondary">{TEXTS.cardText}</p>
        </Card>
      </BoardState>
      <BoardState state="card-box" label={TEXTS.cardBox} bare>
        <Card variant="box">
          <p className="text-md text-text-secondary">{TEXTS.cardText}</p>
        </Card>
      </BoardState>
      <BoardState state="card-link" label={TEXTS.cardLink} bare>
        <Card variant="link" href="#board-surface" title={TEXTS.linkTitle}>
          <p className="text-md text-text-secondary">{TEXTS.linkText}</p>
        </Card>
      </BoardState>
      <BoardState state="inner-panel" label={TEXTS.panelDefault} bare>
        <Card>
          <InnerPanel title={TEXTS.panelTitle}>
            <p className="text-md text-text-secondary">{TEXTS.panelText}</p>
          </InnerPanel>
        </Card>
      </BoardState>
      <BoardState state="inner-panel-readonly" label={TEXTS.panelReadonly} bare>
        <Card>
          <InnerPanel
            variant="readonly"
            title={TEXTS.readonlyLabel}
            action={
              <Button variant="secondary" size="sm">
                {TEXTS.readonlyAction}
              </Button>
            }
          >
            {TEXTS.readonlyValue}
          </InnerPanel>
        </Card>
      </BoardState>
      <BoardState state="inner-panel-preview" label={TEXTS.panelPreview} bare>
        <Card>
          <InnerPanel
            variant="preview"
            title={TEXTS.previewCap}
            icon={<InfoIcon className="size-(--size-icon-sm)" />}
          >
            <p className="text-md text-text-secondary">{TEXTS.previewText}</p>
          </InnerPanel>
        </Card>
      </BoardState>
      <BoardState state="inner-panel-form" label={TEXTS.panelForm} bare>
        <Card>
          <InnerPanel variant="form" title={TEXTS.panelTitle}>
            <p className="text-md text-text-secondary">{TEXTS.panelText}</p>
          </InnerPanel>
        </Card>
      </BoardState>
      <BoardState state="card-actions" label={TEXTS.actions} bare>
        <Card>
          <CardActions>
            <Button>{TEXTS.principal}</Button>
            <Button variant="secondary">{TEXTS.secondary}</Button>
          </CardActions>
        </Card>
      </BoardState>
      <BoardState
        state="card-actions-stretch"
        label={TEXTS.actionsStretch}
        bare
      >
        <Card>
          <CardActions stretch>
            <Button>{TEXTS.principal}</Button>
            <Button variant="secondary">{TEXTS.secondary}</Button>
          </CardActions>
        </Card>
      </BoardState>
    </BoardSection>
  );
}
