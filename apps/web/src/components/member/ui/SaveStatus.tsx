"use client";

import { useEffect } from "react";
import { cn } from "@/components/ui/class-names";
import {
  CircleAlertIcon,
  CircleCheckIcon,
  ClockIcon,
  LoaderCircleIcon,
} from "@/components/ui/icons";
import { useAnnouncer } from "./Announcer";
import { Button } from "./Button";
import {
  SAVE_STATUS_RETRY_IN_CLASSES,
  saveStatusClasses,
  saveStatusIconClasses,
  type SaveState,
  type SaveStatusPlacement,
} from "./save-status-classes";

const STATE_ICONS = {
  idle: ClockIcon,
  saving: LoaderCircleIcon,
  saved: CircleCheckIcon,
  failed: CircleAlertIcon,
};

export type SaveStatusProps = {
  /** Nothing sent yet, sending, saved, or not saved. */
  state: SaveState;
  /** The time of the last save, as it is read ("14:07"); the text of `saved` is written from it. */
  savedAt?: string;
  /** The seconds before the next automatic try, told after a failure. */
  retryInSeconds?: number;
  /** Retries the save: offered with a failure, when given. */
  onRetry?: () => void;
  /** At the centre of the foot of the wizard (`foot`) or in its line of meta (`meta`, the default). */
  placement?: SaveStatusPlacement;
  /** "Saved automatically", already translated. */
  idleText: string;
  /** "Saving…". */
  savingText: string;
  /** "Saved at 14:07": the sentence written from the time. */
  savedText: (time: string) => string;
  /** "Not saved: your changes are kept here", read aloud when the failure comes. */
  failedText: string;
  /** "Next try in 5 s". */
  retryInText?: (seconds: number) => string;
  /** The label of the button that tries again. */
  retryLabel?: string;
  className?: string;
};

/** Reads the failure aloud once, when it appears: the page's region (C29), never a region of its own. */
function AnnounceFailure({ message }: { message: string }) {
  const announce = useAnnouncer();
  useEffect(() => {
    announce(message);
  }, [announce, message]);
  return null;
}

/**
 * The state of the automatic save (C25): an icon and a sentence for each of the four states. Only the failure is
 * announced (once, by the announcer of the page): sending and saved are read where the member looks, and a
 * region that spoke at every save would talk all along the form. A failure offers to try again.
 */
export function SaveStatus({
  state,
  savedAt,
  retryInSeconds,
  onRetry,
  placement,
  idleText,
  savingText,
  savedText,
  failedText,
  retryInText,
  retryLabel,
  className,
}: SaveStatusProps) {
  const Icon = STATE_ICONS[state];
  let text: string;
  switch (state) {
    case "saving":
      text = savingText;
      break;
    case "saved":
      text = savedAt === undefined ? idleText : savedText(savedAt);
      break;
    case "failed":
      text = failedText;
      break;
    default:
      text = idleText;
  }
  const retryIn =
    state === "failed" &&
    retryInSeconds !== undefined &&
    retryInText !== undefined
      ? retryInText(retryInSeconds)
      : null;
  return (
    <p
      data-save-state={state}
      className={cn(saveStatusClasses(state, placement), className)}
    >
      {state === "failed" ? <AnnounceFailure message={failedText} /> : null}
      <Icon aria-hidden="true" className={saveStatusIconClasses(state)} />
      <span>{text}</span>
      {retryIn === null ? null : (
        <span className={SAVE_STATUS_RETRY_IN_CLASSES}>{retryIn}</span>
      )}
      {state === "failed" &&
      onRetry !== undefined &&
      retryLabel !== undefined ? (
        <Button variant="text" onClick={onRetry}>
          {retryLabel}
        </Button>
      ) : null}
    </p>
  );
}
