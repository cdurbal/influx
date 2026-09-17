"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { cn } from "./class-names";

export type LanguageOption = {
  locale: AppLocale;
  /** Visible short label, e.g. "FR". */
  shortLabel: string;
  /** Language name in that language, read by screen readers, e.g. "Français". */
  name: string;
};

type LanguageSwitcherProps = {
  groupLabel: string;
  options: readonly LanguageOption[];
  currentLocale: AppLocale;
};

// In-memory only (never stored in cookies or web storage): which language was just chosen, so
// that focus can return to its button once the page has re-rendered in that language (02 §3.2).
let pendingFocusLocale: AppLocale | null = null;

function rememberPendingFocus(locale: AppLocale): void {
  pendingFocusLocale = locale;
}

function consumePendingFocus(locale: AppLocale): boolean {
  if (pendingFocusLocale !== locale) {
    return false;
  }
  pendingFocusLocale = null;
  return true;
}

/** FR/EN switcher (02 §3.2): replaces the page by its other-language version, without a link. */
export function LanguageSwitcher({
  groupLabel,
  options,
  currentLocale,
}: LanguageSwitcherProps) {
  const router = useRouter();
  const pathname = usePathname();
  const buttonRefs = useRef<Partial<Record<AppLocale, HTMLButtonElement>>>({});

  useEffect(() => {
    if (consumePendingFocus(currentLocale)) {
      buttonRefs.current[currentLocale]?.focus();
    }
  }, [currentLocale]);

  function handleSelect(locale: AppLocale) {
    if (locale === currentLocale) {
      return;
    }
    rememberPendingFocus(locale);
    // localeCookie is disabled in routing.ts: switching writes no cookie (CA8).
    router.replace(pathname, { locale, scroll: false });
  }

  return (
    <div
      role="group"
      aria-label={groupLabel}
      className="inline-flex shrink-0 items-center rounded-pill border-(length:--border-width-thin) border-border-strong p-1"
    >
      {options.map((option) => {
        const isActive = option.locale === currentLocale;
        return (
          <button
            key={option.locale}
            ref={(element) => {
              if (element) {
                buttonRefs.current[option.locale] = element;
              }
            }}
            type="button"
            aria-pressed={isActive}
            onClick={() => handleSelect(option.locale)}
            className={cn(
              "inline-flex size-(--size-touch-target) items-center justify-center rounded-pill text-sm transition-colors",
              isActive
                ? "bg-surface-inverse font-bold text-text-inverse"
                : "font-medium text-text-primary hover:bg-action-secondary-bg-hover",
            )}
          >
            {option.shortLabel}
            <span className="sr-only" lang={option.locale}>
              {option.name}
            </span>
          </button>
        );
      })}
    </div>
  );
}
