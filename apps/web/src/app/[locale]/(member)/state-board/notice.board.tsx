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
    "Trois tons d'une notice, puis la notice d'erreur : une icône et un texte, jamais la couleur seule. " +
    "Chacune est annoncée (status ou alert) ; la version sans annonce est celle d'un texte déjà relié à son objet.",
  error: "Erreur",
  errorText: "L'enregistrement a échoué. Réessayez dans un instant.",
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
