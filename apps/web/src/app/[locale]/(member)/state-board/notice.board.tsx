import { Button } from "@/components/member/ui/Button";
import { Notice } from "@/components/member/ui/Notice";
import type { NoticeTone } from "@/components/member/ui/notice-classes";
import { ErrorNotice } from "@/components/ui/ErrorNotice";
import { BoardSection, BoardState } from "./board-section.board";

const TONES: readonly { tone: NoticeTone; label: string; text: string }[] = [
  {
    tone: "success",
    label: "Succès",
    text: "Votre profil est enregistré.",
  },
  {
    tone: "warning",
    label: "Avertissement",
    text: "Un réseau n'est pas encore renseigné.",
  },
  {
    tone: "info",
    label: "Information",
    text: "Votre commercial vous répond sous un jour ouvré.",
  },
];

const TEXTS = {
  title: "Notice",
  note:
    "C17 : trois tons d'une notice (icône de 16 px, écart de 12 px), avec un titre, avec une action, en bandeau (icône, " +
    "texte et action sur une ligne centrée, qui passent à la ligne ensemble), puis la notice d'erreur : une icône et un " +
    "texte, jamais la couleur seule. Chacune est annoncée (status ou alert) ; la version sans annonce est celle d'un " +
    "texte déjà relié à son objet.",
  error: "Erreur",
  errorText: "L'enregistrement a échoué. Réessayez dans un instant.",
  titled: "Avec un titre",
  titledTitle: "« Coffret de fêtes » est à corriger.",
  titledText: "Votre brief ne permet pas de comprendre le livrable attendu.",
  action: "Avec une action",
  actionLabel: "Corriger",
  strip: "Bandeau : texte et action sur une ligne",
  stripText: "Brief à préciser.",
  stripWrap: "Bandeau, texte long : l'action passe dessous",
  stripLong:
    "Un texte assez long pour que le bandeau le fasse passer à la ligne avant son action, sans rien déborder à 375 px.",
  silent: "Sans annonce",
  silentText: "Ce texte est déjà relié à son champ.",
} as const;

/** The notices of the connected spaces: the three tones of `Notice` and `ErrorNotice`. */
export function NoticeBoard() {
  return (
    <BoardSection component="notice" title={TEXTS.title} note={TEXTS.note}>
      {TONES.map(({ tone, label, text }) => (
        <BoardState key={tone} state={tone} label={label} className="flex-col">
          <Notice tone={tone}>{text}</Notice>
        </BoardState>
      ))}
      <BoardState state="titled" label={TEXTS.titled} className="flex-col">
        <Notice tone="warning" title={TEXTS.titledTitle}>
          {TEXTS.titledText}
        </Notice>
      </BoardState>
      <BoardState state="action" label={TEXTS.action} className="flex-col">
        <Notice
          tone="info"
          action={<Button size="sm">{TEXTS.actionLabel}</Button>}
        >
          {TONES[2]?.text}
        </Notice>
      </BoardState>
      <BoardState state="strip" label={TEXTS.strip} className="flex-col">
        <Notice
          tone="warning"
          size="strip"
          title={TEXTS.titledTitle}
          action={<Button>{TEXTS.actionLabel}</Button>}
        >
          {TEXTS.stripText}
        </Notice>
      </BoardState>
      <BoardState
        state="strip-long"
        label={TEXTS.stripWrap}
        className="flex-col"
      >
        <Notice
          tone="success"
          size="strip"
          action={<Button variant="secondary">{TEXTS.actionLabel}</Button>}
        >
          {TEXTS.stripLong}
        </Notice>
      </BoardState>
      <BoardState state="error" label={TEXTS.error} className="flex-col">
        <ErrorNotice>{TEXTS.errorText}</ErrorNotice>
      </BoardState>
      <BoardState state="silent" label={TEXTS.silent} className="flex-col">
        <Notice tone="info" announce={false}>
          {TEXTS.silentText}
        </Notice>
      </BoardState>
    </BoardSection>
  );
}
