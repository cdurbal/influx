"use client";

import { useState } from "react";
import { useAnnouncer } from "@/components/member/ui/Announcer";
import { MemberButton } from "@/components/member/ui/MemberButton";
import { BoardSection, BoardState } from "./board-section.board";

const TEXTS = {
  title: "Annonceur",
  note:
    "Une seule région de statut par page, hors écran, montée au niveau de la planche. Un bouton y écrit un " +
    "message : la région est vidée, puis écrite ; un texte répété est donc lu de nouveau.",
  cell: "Annonce d'un message",
  button: "Annoncer un message",
  message: "Le profil est enregistré.",
  count: "Messages annoncés :",
} as const;

/** The announcer (C29): the button writes into the one region of the page, and counts what it sent. */
export function AnnouncerBoard() {
  const announce = useAnnouncer();
  const [sent, setSent] = useState(0);
  return (
    <BoardSection component="announcer" title={TEXTS.title} note={TEXTS.note}>
      <BoardState state="announce" label={TEXTS.cell} className="items-center">
        <MemberButton
          variant="secondary"
          onClick={() => {
            announce(TEXTS.message);
            setSent((count) => count + 1);
          }}
        >
          {TEXTS.button}
        </MemberButton>
        <p className="text-sm text-text-secondary">
          {TEXTS.count} {sent}
        </p>
      </BoardState>
    </BoardSection>
  );
}
