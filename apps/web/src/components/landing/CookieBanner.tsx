"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/components/ui/class-names";
import {
  createConsent,
  IS_COOKIE_BANNER_ENABLED,
  readStoredConsent,
  writeStoredConsent,
  type CookieConsentDecision,
} from "./cookie-consent";

type CookieBannerProps = {
  regionLabel: string;
  title: string;
  body: string;
  acceptLabel: string;
  rejectLabel: string;
  privacyLinkLabel: string;
};

type Phase = "entering" | "open" | "leaving" | "closed";

/**
 * Cookie consent banner (11-consentement-cookies.md).
 *
 * Non-modal region: no dialog role, no aria-modal, no focus trap, no scrim, no close button and
 * Escape does not close it — closing without choosing would be an implicit choice (11 §6.4).
 * Both buttons share the very same secondary style: refusing is exactly as easy as accepting.
 * The component itself sets no tracker and the choice is kept by cookie-consent.ts (11 §7).
 * Mobile: bottom sheet, full width. Desktop: floating card, bottom left.
 */
export function CookieBanner({
  regionLabel,
  title,
  body,
  acceptLabel,
  rejectLabel,
  privacyLinkLabel,
}: CookieBannerProps) {
  // A choice already made means the banner is never mounted: no flash (11 §6.3). The stored
  // choice is unknown on the server, so the first client render matches the server one.
  const [phase, setPhase] = useState<Phase>(() =>
    readStoredConsent() ? "closed" : "entering",
  );
  const bannerRef = useRef<HTMLElement>(null);

  // Entry animation: the banner slides up from its own height once painted (11 §6.1).
  useEffect(() => {
    if (phase !== "entering") {
      return;
    }
    const frame = requestAnimationFrame(() => setPhase("open"));
    return () => cancelAnimationFrame(frame);
  }, [phase]);

  useEffect(() => {
    const banner = bannerRef.current;
    if (phase === "closed" || !banner) {
      return;
    }
    const root = document.documentElement;
    // scroll-padding-bottom follows the real banner height, so a focused element never hides
    // under it (WCAG 2.4.11). Runtime measurement, not a design value.
    const observer = new ResizeObserver(() => {
      root.style.setProperty(
        "--cookie-banner-height",
        `${banner.offsetHeight}px`,
      );
    });
    observer.observe(banner);
    root.dataset.cookieBanner = "open";
    return () => {
      observer.disconnect();
      delete root.dataset.cookieBanner;
      root.style.removeProperty("--cookie-banner-height");
    };
  }, [phase]);

  // Exit animation: the banner leaves the DOM once its transition is over. The delay is read
  // from the element itself, so prefers-reduced-motion (duration-instant) needs no special case.
  useEffect(() => {
    if (phase !== "leaving") {
      return;
    }
    const banner = bannerRef.current;
    const seconds = banner
      ? Number.parseFloat(
          getComputedStyle(banner).transitionDuration.split(",")[0] ?? "0",
        )
      : 0;
    const timer = window.setTimeout(
      () => setPhase("closed"),
      Number.isNaN(seconds) ? 0 : seconds * 1000,
    );
    return () => window.clearTimeout(timer);
  }, [phase]);

  function choose(decision: CookieConsentDecision) {
    writeStoredConsent(createConsent(decision));
    setPhase("leaving");
    // The focus never falls back on <body>: it goes to the first visible control of the header.
    const headerControls = Array.from(
      document.querySelectorAll<HTMLElement>("header button"),
    );
    headerControls.find((control) => control.offsetParent !== null)?.focus();
  }

  if (!IS_COOKIE_BANNER_ENABLED || phase === "closed") {
    return null;
  }

  return (
    <section
      ref={bannerRef}
      aria-label={regionLabel}
      data-cookie-banner=""
      className={cn(
        "fixed inset-x-0 bottom-0 z-(--z-cookie-banner) rounded-t-lg border-t-(length:--border-width-thin)",
        "border-border-default bg-surface-raised px-inset-card pt-inset-card shadow-lg",
        "transition-transform duration-(--duration-base) ease-standard",
        "md:inset-x-auto md:bottom-5 md:left-5 md:max-w-(--size-cookie-banner) md:rounded-lg",
        "md:border-(length:--border-width-thin)",
        phase === "open" ? "translate-y-0" : "translate-y-full",
        phase === "leaving" && "duration-(--duration-fast) ease-exit",
      )}
    >
      <p className="text-sm font-semibold tracking-normal text-text-primary">
        {title}
      </p>
      <p className="mt-stack-sm text-sm leading-body font-regular text-text-secondary">
        {body}
      </p>
      <div className="mt-stack-md flex flex-wrap gap-3">
        <Button
          variant="secondary"
          size="md"
          className="grow basis-2/5 text-sm md:grow-0 md:basis-auto"
          onClick={() => choose("accepted")}
        >
          {acceptLabel}
        </Button>
        <Button
          variant="secondary"
          size="md"
          className="grow basis-2/5 text-sm md:grow-0 md:basis-auto"
          onClick={() => choose("rejected")}
        >
          {rejectLabel}
        </Button>
      </div>
      {/* Underlined on purpose: the brand green is never the only carrier of meaning (11 §5). */}
      <Button
        variant="text"
        className="mt-stack-md -ml-3 text-xs text-text-brand underline hover:text-text-brand-strong"
      >
        {privacyLinkLabel}
      </Button>
    </section>
  );
}
