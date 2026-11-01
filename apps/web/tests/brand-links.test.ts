// The brand of the two error screens leads to the landing of the page's language (L2A-06; feat
// 5e49da1). A journey cannot reach them (an error of a layout or of a page is not made on
// demand), so they are rendered here, in the language the route carries; the legal pages, the page
// not found and the terms barrier are in e2e/landing-navigation.spec.ts.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import en from "@/locales/en/errors.json";
import fr from "@/locales/fr/errors.json";

const params = vi.hoisted(() => ({
  current: {} as { locale?: string } | null,
}));
vi.mock("next/navigation", () => ({ useParams: () => params.current }));

import GlobalError from "@/app/global-error";
import LocaleError from "@/app/[locale]/error";

/** The attributes of the link whose text is the brand, or null when the brand is no link. */
function brandLink(markup: string, brand: string): { href: string } | null {
  const match = new RegExp(`<a [^>]*href="([^"]*)"[^>]*>${brand}</a>`).exec(
    markup,
  );
  return match?.[1] === undefined ? null : { href: match[1] };
}

const LOCALES = [
  ["fr", fr],
  ["en", en],
] as const;

describe("the brand of the error screens (feat 5e49da1)", () => {
  beforeEach(() => {
    params.current = {};
  });

  for (const [locale, messages] of LOCALES) {
    it(`error.tsx: the brand is a link to /${locale}`, () => {
      params.current = { locale };
      const markup = renderToStaticMarkup(
        createElement(LocaleError, { reset: () => undefined }),
      );
      expect(brandLink(markup, messages.brand)).toEqual({
        href: `/${locale}`,
      });
    });

    it(`global-error.tsx: the brand is a link to /${locale}`, () => {
      params.current = { locale };
      const markup = renderToStaticMarkup(createElement(GlobalError));
      expect(brandLink(markup, messages.brand)).toEqual({
        href: `/${locale}`,
      });
    });
  }

  it("global-error.tsx falls back to French when the route carries no language", () => {
    params.current = null;
    const markup = renderToStaticMarkup(createElement(GlobalError));
    expect(brandLink(markup, fr.brand)).toEqual({ href: "/fr" });
  });
});
