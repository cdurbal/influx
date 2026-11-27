import type { Metadata } from "next";
import { BoardHeader, boardTitle } from "../board-section.board";
import { CardBoard } from "../card.board";

// The family `card` of the component state board (RUB-fix-10a; jalons/rub/modele-archi.md §4): its page alone,
// served like the index only when the `board.tsx` page extension is on (src/config/state-board.ts).

const INTRO =
  "Ligne 09a de RUB : la carte photo et la carte de fil (C31, C48).";

export const metadata: Metadata = { title: boardTitle("card") };

export default function CardBoardPage() {
  return (
    <>
      <BoardHeader title={boardTitle("card")} intro={INTRO} />
      <CardBoard />
    </>
  );
}
