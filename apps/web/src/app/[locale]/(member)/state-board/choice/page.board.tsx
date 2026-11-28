import type { Metadata } from "next";
import { BoardHeader, boardTitle } from "../board-section.board";
import { ChoiceBoard } from "../choice.board";

// The family `choice` of the component state board (RUB-fix-10a; archives/jalons/rub/modele-archi.md §4): its page alone,
// served like the index only when the `board.tsx` page extension is on (src/config/state-board.ts).

const INTRO =
  "Ligne 06 de RUB : les segments, les étiquettes, la zone interne, l'état d'enregistrement, le repli et la date (C22 à C26, C47).";

export const metadata: Metadata = { title: boardTitle("choice") };

export default function ChoiceBoardPage() {
  return (
    <>
      <BoardHeader title={boardTitle("choice")} intro={INTRO} />
      <ChoiceBoard />
    </>
  );
}
