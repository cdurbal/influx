"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/components/ui/class-names";
import { CloseIcon, MenuIcon } from "@/components/ui/icons";
import { LinkButton } from "@/components/ui/LinkButton";

export type HeaderNavItem = { id: string; label: string };

type SiteHeaderMobileMenuProps = {
  menuButtonLabel: string;
  navLabel: string;
  navItems: readonly HeaderNavItem[];
  loginCta: string;
  signupCta: string;
};

const PANEL_ID = "site-header-mobile-menu";

/**
 * Mobile menu below breakpoint lg (02 §3.2). Opening moves focus to the first entry, makes main
 * and footer inert and locks page scroll; Escape, the close button or a click on the scrim close
 * it and return focus to the menu button. Entries and CTAs have no effect (CA7).
 */
export function SiteHeaderMobileMenu({
  menuButtonLabel,
  navLabel,
  navItems,
  loginCta,
  signupCta,
}: SiteHeaderMobileMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const scrimRef = useRef<HTMLDivElement>(null);
  const firstItemRef = useRef<HTMLButtonElement>(null);

  const close = useCallback((restoreFocus: boolean) => {
    setIsOpen(false);
    if (restoreFocus) {
      toggleRef.current?.focus();
    }
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    firstItemRef.current?.focus();

    const root = document.documentElement;
    root.dataset.mobileMenu = "open";
    const inertElements = Array.from(document.querySelectorAll("main, footer"));
    inertElements.forEach((element) => element.setAttribute("inert", ""));

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        close(true);
      }
    }
    function handlePointerDown(event: PointerEvent) {
      if (event.target === scrimRef.current) {
        close(true);
      }
    }
    function handleResize() {
      // The toggle is hidden from breakpoint lg: the desktop menu takes over.
      if (toggleRef.current?.offsetParent === null) {
        close(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("resize", handleResize);
    return () => {
      delete root.dataset.mobileMenu;
      inertElements.forEach((element) => element.removeAttribute("inert"));
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("resize", handleResize);
    };
  }, [isOpen, close]);

  return (
    <div className="lg:hidden">
      <Button
        ref={toggleRef}
        variant="icon"
        aria-label={menuButtonLabel}
        aria-expanded={isOpen}
        aria-controls={PANEL_ID}
        onClick={() => (isOpen ? close(true) : setIsOpen(true))}
      >
        {isOpen ? (
          <CloseIcon aria-hidden="true" className="size-(--size-icon-lg)" />
        ) : (
          <MenuIcon aria-hidden="true" className="size-(--size-icon-lg)" />
        )}
      </Button>

      {/*
        Negative z-index inside the header stacking context: the scrim covers the page but stays
        under the header bar, so the brand, FR/EN and the close button remain visible and usable
        while the menu is open (02 §3.2, 10 #4).
      */}
      <div
        ref={scrimRef}
        aria-hidden="true"
        hidden={!isOpen}
        className="fixed inset-0 -z-(--z-raised) bg-overlay-scrim"
      />
      <div
        id={PANEL_ID}
        hidden={!isOpen}
        className={cn(
          "absolute inset-x-0 top-full z-(--z-overlay) max-h-(--size-mobile-menu-max-height) overflow-y-auto",
          "bg-surface-raised px-page-gutter py-5 shadow-lg",
        )}
      >
        <nav aria-label={navLabel}>
          <ul className="flex flex-col gap-1">
            {navItems.map((item, index) => (
              <li key={item.id}>
                <Button
                  ref={index === 0 ? firstItemRef : undefined}
                  variant="text"
                  fullWidth
                  className="justify-start"
                >
                  {item.label}
                </Button>
              </li>
            ))}
          </ul>
        </nav>
        <div className="mt-4 flex flex-col gap-stack-sm border-t-(length:--border-width-thin) border-border-subtle pt-4">
          <LinkButton href="/space" variant="secondary" size="lg" fullWidth>
            Mon Espace (Hub)
          </LinkButton>
          <LinkButton href="/signup" variant="primary" size="lg" fullWidth>
            {signupCta}
          </LinkButton>
          <LinkButton href="/login" variant="secondary" size="lg" fullWidth>
            {loginCta}
          </LinkButton>
        </div>
      </div>
    </div>
  );
}
