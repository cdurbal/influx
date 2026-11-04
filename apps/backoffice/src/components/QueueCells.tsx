// The cells every queue shares (docs/mvp/17b §2.2; 15 RG27 C2 C5, RG119; L2C-16): the state, the
// deadline and the lock of an entry. Each carries a written label: the icon has its own shape and
// the colour only underlines, it never carries the state alone.
import { messages } from "@/messages/fr";
import { cn } from "./auth-classes";
import { CircleIcon, FlagIcon, LockIcon } from "./icons";
import {
  dueWords,
  isEscalated,
  lockWords,
  rowStateOf,
  type RowState,
} from "./queue-view-model";
import type { QueueEntryRow } from "@influx/contracts/backoffice-queues";

const t = messages.queueList;

type RowFacts = Pick<
  QueueEntryRow,
  "overdue" | "claim" | "slaDueAt" | "escalateAt"
>;

const STATE_ICONS: Record<RowState, typeof FlagIcon> = {
  overdue: FlagIcon,
  held: LockIcon,
  free: CircleIcon,
};

const STATE_ICON_CLASSES: Record<RowState, string> = {
  overdue: "text-feedback-error-icon",
  held: "text-text-secondary",
  free: "text-text-tertiary",
};

/** Column 1: a flag, a lock or an empty circle, and the state written for a screen reader. */
export function StateCell({ row }: { row: RowFacts }) {
  const state = rowStateOf(row);
  const Icon = STATE_ICONS[state];
  return (
    <>
      <Icon
        aria-hidden="true"
        className={cn("size-(--size-icon-md)", STATE_ICON_CLASSES[state])}
      />
      <span className="sr-only">{t.state[state]}</span>
    </>
  );
}

/** "HORS DÉLAI depuis 3 h 12" or "dans 2 h 05", then the date; a decision stays possible (C8). */
export function DueCell({ row, asOf }: { row: RowFacts; asOf: string }) {
  const due = dueWords(row, asOf);
  return (
    <>
      <span
        className={cn(
          "block tabular-nums",
          due.overdue && "font-bold text-feedback-error-text",
        )}
      >
        {due.text}
      </span>
      <span className="block text-text-secondary tabular-nums">{due.at}</span>
      {isEscalated(row, asOf) ? (
        <span className="block font-semibold text-feedback-warning-text">
          {t.escalated}
        </span>
      ) : null}
    </>
  );
}

/** "libre", or the name of the holder and the hour: never a technical identifier (C2). */
export function LockCell({ row }: { row: RowFacts }) {
  return <span className="tabular-nums">{lockWords(row)}</span>;
}
