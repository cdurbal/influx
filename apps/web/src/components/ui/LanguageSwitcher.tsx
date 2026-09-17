"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { cn } from "./class-names";
import { GlobeIcon } from "./icons";

export type LanguageOption = {
  locale: AppLocale;
  /** Visible short code, e.g. "FR". */
  shortLabel: string;
  /** Language name in that language, read by screen readers, e.g. "Français". */
  name: string;
};

type LanguageSwitcherProps = {
  label: string;
  options: readonly LanguageOption[];
  currentLocale: AppLocale;
};

const MENU_ID = "site-header-language-menu";

// In-memory only (never stored in cookies or web storage): whether a language was just chosen,
// so that focus can return to the trigger once the page has re-rendered in that language.
let pendingFocus = false;

function rememberPendingFocus(): void {
  pendingFocus = true;
}

function consumePendingFocus(): boolean {
  if (!pendingFocus) {
    return false;
  }
  pendingFocus = false;
  return true;
}

/**
 * Language menu (Malt-style header): a single globe + 2-letter code trigger opens the list of
 * every available language, rather than a fixed FR/EN pill — more languages are coming soon.
 */
export function LanguageSwitcher({
  label,
  options,
  currentLocale,
}: LanguageSwitcherProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const firstItemRef = useRef<HTMLButtonElement>(null);

  // options always includes the current locale: SiteHeader and AuthHeader build it from the
  // same routing.ts locale list.
  const currentOption =
    options.find((option) => option.locale === currentLocale) ?? options[0]!;

  const close = useCallback((restoreFocus: boolean) => {
    setIsOpen(false);
    if (restoreFocus) {
      triggerRef.current?.focus();
    }
  }, []);

  useEffect(() => {
    if (consumePendingFocus()) {
      triggerRef.current?.focus();
    }
  }, [currentLocale]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    firstItemRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        close(true);
      }
    }
    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (
        !menuRef.current?.contains(target) &&
        !triggerRef.current?.contains(target)
      ) {
        close(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isOpen, close]);

  function handleSelect(locale: AppLocale) {
    close(false);
    if (locale === currentLocale) {
      return;
    }
    rememberPendingFocus();
    // localeCookie is disabled in routing.ts: switching writes no cookie (CA8).
    router.replace(pathname, { locale, scroll: false });
  }

  return (
    <div className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-controls={MENU_ID}
        aria-label={`${label} : ${currentOption.name}`}
        onClick={() => (isOpen ? close(true) : setIsOpen(true))}
        className={cn(
          "inline-flex h-(--size-touch-target) items-center gap-2 rounded-pill border-(length:--border-width-thin) border-border-strong px-3",
          "text-sm font-medium text-text-primary transition-colors hover:bg-action-secondary-bg-hover",
        )}
      >
        <GlobeIcon
          aria-hidden="true"
          className="size-(--size-icon-md) shrink-0"
        />
        <span aria-hidden="true">{currentOption.shortLabel}</span>
      </button>
      <div
        id={MENU_ID}
        ref={menuRef}
        role="group"
        aria-label={label}
        hidden={!isOpen}
        className="absolute right-0 top-full z-(--z-overlay) mt-2 overflow-hidden rounded-md border-(length:--border-width-thin) border-border-subtle bg-surface-raised py-1 shadow-lg"
      >
        {options.map((option, index) => {
          const isActive = option.locale === currentLocale;
          return (
            <button
              key={option.locale}
              ref={index === 0 ? firstItemRef : undefined}
              type="button"
              aria-pressed={isActive}
              lang={option.locale}
              onClick={() => handleSelect(option.locale)}
              className={cn(
                "flex w-full items-center whitespace-nowrap px-4 py-2 text-left text-sm transition-colors",
                isActive
                  ? "font-bold text-text-primary"
                  : "font-medium text-text-secondary hover:bg-action-secondary-bg-hover",
              )}
            >
              {option.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
