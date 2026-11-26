"use client";

import { useEffect, type ComponentType, type ReactNode } from "react";
import {
  CircleCheckIcon,
  FilterIcon,
  InboxIcon,
  LockIcon,
  TriangleAlertIcon,
} from "@/components/ui/icons";
import { cn } from "@/components/ui/class-names";
import { useAnnouncer } from "./Announcer";
import {
  EMPTY_STATE_BODY_CLASSES,
  EMPTY_STATE_ICON_CLASSES,
  EMPTY_STATE_INLINE_ICON_CLASSES,
  EMPTY_STATE_INLINE_TEXT_CLASSES,
  EMPTY_STATE_TITLE_CLASSES,
  emptyStateClasses,
  type EmptyStateKind,
} from "./empty-state-classes";

/** What a lucide icon of `icons.ts` is, as far as the message is concerned: it takes a class, it is decorative. */
type StateIcon = ComponentType<{ className?: string; "aria-hidden"?: "true" }>;

export type EmptyStateProps = {
  /** Why there is nothing to show: nothing yet, nothing under the filters, a failure, a closed thing, a sent one, or one line. */
  kind: EmptyStateKind;
  /** A decorative icon of `icons.ts`, drawn at the size of the kind; the icon of the kind when absent. */
  icon?: StateIcon;
  /** The title, already translated; for the `inline` kind, the one phrase. */
  title: string;
  /** A sentence under the title (ignored by the `inline` kind). */
  body?: ReactNode;
  /** One action at most: a button, "Reset" for `filtered`, "Retry" for `error`; never "Create" under a filter. */
  action?: ReactNode;
  /** Announces the title when the message appears (a list that came back empty, a retry that failed). */
  live?: boolean;
  id?: string;
  className?: string;
};

const KIND_ICONS = {
  empty: InboxIcon,
  filtered: FilterIcon,
  error: TriangleAlertIcon,
  closed: LockIcon,
  sent: CircleCheckIcon,
  inline: CircleCheckIcon,
};

/** Speaks the message once, when the message appears; the region is the page's (C29). */
function AnnounceOnAppearing({ message }: { message: string }) {
  const announce = useAnnouncer();
  useEffect(() => {
    announce(message);
  }, [announce, message]);
  return null;
}

/**
 * What a page says when there is nothing to show (C08): never a bare blank. No frame, an icon, a title
 * (a paragraph styled as a section title: the headings of the page stay with C01 to C03), a sentence and
 * one action at most. `filtered` offers to reset, `error` to retry, and neither offers to create.
 */
export function EmptyState({
  kind,
  icon: Icon = KIND_ICONS[kind],
  title,
  body,
  action,
  live = false,
  id,
  className,
}: EmptyStateProps) {
  const announce = live ? <AnnounceOnAppearing message={title} /> : null;
  if (kind === "inline") {
    return (
      <div id={id} className={cn(emptyStateClasses(kind), className)}>
        {announce}
        <Icon aria-hidden="true" className={EMPTY_STATE_INLINE_ICON_CLASSES} />
        <p className={EMPTY_STATE_INLINE_TEXT_CLASSES}>{title}</p>
      </div>
    );
  }
  return (
    <div id={id} className={cn(emptyStateClasses(kind), className)}>
      {announce}
      <Icon aria-hidden="true" className={EMPTY_STATE_ICON_CLASSES} />
      <p className={EMPTY_STATE_TITLE_CLASSES}>{title}</p>
      {body === undefined ? null : (
        <div className={EMPTY_STATE_BODY_CLASSES}>{body}</div>
      )}
      {action === undefined ? null : <div>{action}</div>}
    </div>
  );
}
