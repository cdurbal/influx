import type { Metadata } from "next";
import { BoardHeader, boardTitle } from "../board-section.board";
import { NoticeBoard } from "../notice.board";
import { BadgeBoard } from "../badge.board";

// The family `badge` of the component state board (RUB-fix-10a; jalons/rub/modele-archi.md §4): its page alone,
// served like the index only when the `board.tsx` page extension is on (src/config/state-board.ts).

const INTRO =
  "Ligne 03 de RUB : la notice, puis les badges, la plaque et la liste de pastilles (C13 à C17, C33, C38).";

export const metadata: Metadata = { title: boardTitle("badge") };

export default function BadgeBoardPage() {
  return (
    <>
      <BoardHeader title={boardTitle("badge")} intro={INTRO} />
      <NoticeBoard />
      <BadgeBoard />
    </>
  );
}
