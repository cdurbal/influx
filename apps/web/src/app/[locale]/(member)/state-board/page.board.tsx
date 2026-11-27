import type { Metadata } from "next";
import { ActionLink } from "@/components/member/ui/ActionLink";
import {
  BOARD_FAMILIES,
  BoardHeader,
  boardTitle,
  type BoardFamily,
} from "./board-section.board";

// The component state board (RUA-05; docs/mvp/jalons/rua/modele-archi.md §6). Not a page of the
// product: Next.js serves this file only when the `board.tsx` page extension is on
// (src/config/state-board.ts: INFLUX_ENV "development" and INFLUX_STATE_BOARD "on"), so a
// deployed build holds neither the route nor a byte of it. It stands inside the KEO container of
// the member group and outside its space: no shell, no session, no call to the API, no account
// data, no secret. French only, written here and not in `locales`: it is a workshop tool. This page
// is the index, with no section: each family of components has its page, `state-board/<family>`
// (RUB-fix-10a), one section per component, one cell per state, with stable `data-board-*` hooks
// for the screenshots of RUB and after. The frame and its mark: layout.board.tsx.

const INTRO =
  "Outil interne, absent des constructions de staging et de production. Chaque composant est " +
  "montré dans les états qu'il a aujourd'hui, sur la page de sa famille.";

export const metadata: Metadata = { title: boardTitle() };

export default async function StateBoardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return (
    <>
      <BoardHeader title={boardTitle()} intro={INTRO} />
      <ul className="flex flex-col gap-3">
        {(Object.keys(BOARD_FAMILIES) as BoardFamily[]).map((family) => (
          <li key={family}>
            <ActionLink variant="go" href={`/${locale}/state-board/${family}`}>
              {BOARD_FAMILIES[family]}
            </ActionLink>
          </li>
        ))}
      </ul>
    </>
  );
}
