"use client";

import { useState, type ReactNode } from "react";
import { cn } from "./class-names";
import { ChevronDownIcon } from "./icons";

export type AccordionItem = {
  id: string;
  title: string;
  content: ReactNode;
};

type AccordionProps = {
  /** Prefix of the button and panel ids, unique in the page. */
  idPrefix: string;
  items: readonly AccordionItem[];
  /** Items open on first render (method: first step; FAQ: none). */
  defaultOpenIds?: readonly string[];
  /** Numbered markers and an ordered list (method, 02 §3.10). */
  numbered?: boolean;
};

/**
 * Accessible accordion (02 §2.4): h3 > button with aria-expanded and aria-controls, panel with the
 * hidden attribute. Panels are independent. State is carried by the chevron shape and
 * aria-expanded, never by color alone.
 */
export function Accordion({
  idPrefix,
  items,
  defaultOpenIds = [],
  numbered = false,
}: AccordionProps) {
  const [openIds, setOpenIds] = useState<ReadonlySet<string>>(
    () => new Set(defaultOpenIds),
  );

  function toggle(id: string) {
    setOpenIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  const entries = items.map((item, index) => {
    const isOpen = openIds.has(item.id);
    const buttonId = `${idPrefix}-${item.id}-button`;
    const panelId = `${idPrefix}-${item.id}-panel`;

    const inner = (
      <>
        <h3 className="text-heading-3 font-semibold text-text-primary">
          <button
            type="button"
            id={buttonId}
            aria-expanded={isOpen}
            aria-controls={panelId}
            onClick={() => toggle(item.id)}
            className="flex min-h-(--size-touch-target) w-full items-center gap-4 rounded-md px-2 py-4 text-left transition-colors hover:bg-action-secondary-bg-hover"
          >
            {numbered ? (
              <span
                aria-hidden="true"
                className={cn(
                  "inline-flex size-(--size-touch-target) shrink-0 items-center justify-center rounded-round text-md font-bold tabular-nums",
                  isOpen
                    ? "bg-action-primary-bg text-text-on-action"
                    : "border-(length:--border-width-thin) border-border-strong bg-surface-card text-text-primary",
                )}
              >
                {String(index + 1).padStart(2, "0")}
              </span>
            ) : null}
            <span className="flex-1">{item.title}</span>
            <ChevronDownIcon
              aria-hidden="true"
              className={cn(
                "size-(--size-icon-md) shrink-0 transition-transform duration-(--duration-base) ease-standard",
                isOpen && "rotate-180",
              )}
            />
          </button>
        </h3>
        <div
          id={panelId}
          hidden={!isOpen}
          className={cn(
            "max-w-(--measure-text) px-2 pb-5 leading-relaxed text-text-secondary",
            numbered && "pl-9",
          )}
        >
          {item.content}
        </div>
      </>
    );

    return numbered ? (
      <li
        key={item.id}
        className="border-b-(length:--border-width-thin) border-border-subtle"
      >
        {inner}
      </li>
    ) : (
      <div
        key={item.id}
        className="border-b-(length:--border-width-thin) border-border-subtle"
      >
        {inner}
      </div>
    );
  });

  return numbered ? <ol>{entries}</ol> : <div>{entries}</div>;
}
