// The main navigation of the backoffice as drawn (sn-fiche TN5; D74; 17b §1.7 "Second niveau"; 20
// §11.8 "Sous-entrée de navigation"): no section links any more, the screens of the active entry
// nested in its <li> of the rail, one `aria-current` per page, the entry an ancestor without it,
// and no Administration for an agent (CA63). Server rendering, no browser, no router (the link is
// a plain <a>); the e2e of backoffice.spec.ts look at the pixels.
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BoNav, type BoNavLinkProps } from "../src/components/BoNav";
import {
  activePlaceOf,
  navItemsOf,
  type InternalRole,
} from "../src/components/bo-nav";
import { messages } from "../src/messages/fr";

function PlainLink({ children, ...props }: BoNavLinkProps) {
  return createElement("a", props, children);
}

/** The markup of the navigation of `role` on `pathname`. */
function render(role: InternalRole, pathname: string): string {
  return renderToStaticMarkup(
    createElement(BoNav, {
      items: navItemsOf(role),
      place: activePlaceOf(pathname),
      LinkComponent: PlainLink,
    }),
  );
}

/** The texts of the links that carry `aria-current`, their icon left out. */
function currentLinks(markup: string): string[] {
  return [
    ...markup.matchAll(/<a [^>]*aria-current="page"[^>]*>(.*?)<\/a>/g),
  ].map((match) => (match[1] ?? "").replace(/<svg.*<\/svg>/, ""));
}

/** The top-level <li> of the entry whose link is `href`, its nested list included. */
function itemOf(markup: string, href: string): string {
  const top = markup.slice(markup.indexOf("<ul") + 3);
  const items: string[] = [];
  let depth = 0;
  let start = -1;
  for (const match of top.matchAll(/<(\/?)(li|ul)[ >]/g)) {
    const closing = match[1] === "/";
    if (match[2] === "ul") {
      depth += closing ? -1 : 1;
      continue;
    }
    if (depth === 0 && !closing) {
      start = match.index;
    }
    if (depth === 0 && closing) {
      items.push(top.slice(start, match.index));
    }
  }
  return items.find((item) => item.includes(`href="${href}"`)) ?? "";
}

const shellSource = readFileSync(
  new URL("../src/components/Shell.tsx", import.meta.url),
  "utf8",
);

describe("TN5: the sub-entries of the active entry, in the one <nav> of the rail", () => {
  it("leaves the shell without section links nor a <nav> of its own: BoNav draws the only one", () => {
    expect(shellSource).not.toContain("SectionLinks");
    expect(shellSource).not.toContain("sectionLinkClasses");
    // A JSX <nav> holds an attribute; the comments only name the element.
    expect(shellSource).not.toMatch(/<nav\s[^>]*=/);
    expect(shellSource).toContain("<BoNav");
  });

  it("nests Inscrits and Invitations in the <li> of Comptes on a record, Inscrits current alone", () => {
    const markup = render(
      "admin",
      "/inscrits/7f1c3c1e-2d0b-4a52-9c5e-0d3b8f7a1b22",
    );
    expect(markup.match(/<nav[ >]/g)).toHaveLength(1);
    expect(markup.match(/<ul[ >]/g)).toHaveLength(2);
    const accounts = itemOf(markup, "/inscrits");
    expect(accounts).toContain(`>${messages.nav.memberInvitations}</a>`);
    expect(accounts).toMatch(/^<li class="[^"]*max-lg:basis-full/);
    expect(itemOf(markup, "/double-validation")).not.toContain("<ul");
    expect(currentLinks(markup)).toEqual([messages.nav.signups]);
  });

  it("keeps the entry as an ancestor: heavier, no aria-current, no surface, no line", () => {
    const markup = render("admin", "/invitations");
    const entry = /<a href="\/inscrits"[^>]*>/.exec(markup)?.[0] ?? "";
    expect(entry).not.toContain("aria-current");
    expect(entry).toContain("font-semibold");
    expect(entry).not.toContain("bg-nav-item-active-bg");
    expect(entry).not.toContain("before:bg-nav-item-active-indicator");
    expect(currentLinks(markup)).toEqual([messages.nav.memberInvitations]);
    const current = /<a [^>]*aria-current="page"[^>]*>/.exec(markup)?.[0] ?? "";
    expect(current).toContain("bg-nav-item-active-bg");
    expect(current).toContain("lg:before:w-(--border-width-thick)");
  });

  it("opens the sub-menu of Administration for an admin, its four screens in order", () => {
    const markup = render("admin", "/reglages/apollo");
    const admin = itemOf(markup, "/double-validation");
    const positions = [
      messages.nav.dualControl,
      messages.nav.internalAccounts,
      messages.nav.apollo,
      messages.nav.health,
    ].map((label) => admin.indexOf(`>${label}</a>`));
    expect(positions.every((position) => position > -1)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    expect(currentLinks(markup)).toEqual([messages.nav.apollo]);
  });

  it("marks the dashboard itself, with no sub-menu anywhere, on its single screen", () => {
    const markup = render("admin", "/accueil");
    expect(markup.match(/<ul[ >]/g)).toHaveLength(1);
    expect(currentLinks(markup)).toEqual([messages.nav.dashboard]);
    expect(currentLinks(render("admin", "/absente"))).toEqual([]);
  });

  it("opens the three screens of Files under the entry on each of them and on an entry of queue 1, one aria-current, for an agent too (L2C-16, L2E-21)", () => {
    const places = [
      ["/files/profils-marque", messages.nav.brandReviewQueue],
      [
        "/files/profils-marque/7f1c3c1e-2d0b-4a52-9c5e-0d3b8f7a1b22",
        messages.nav.brandReviewQueue,
      ],
      ["/files/verifications-createurs", messages.nav.verificationCreators],
      ["/files/verifications-marques", messages.nav.verificationBrands],
    ] as const;
    for (const [pathname, current] of places) {
      for (const role of ["agent", "admin"] as const) {
        const markup = render(role, pathname);
        const files = itemOf(markup, "/files/profils-marque");
        // Files is an ancestor, its three screens nested in order, the page's own the only current one
        expect(currentLinks(markup), pathname).toEqual([current]);
        const positions = [
          messages.nav.brandReviewQueue,
          messages.nav.verificationCreators,
          messages.nav.verificationBrands,
        ].map((label) => files.indexOf(`>${label}</a>`));
        expect(positions.every((position) => position > -1)).toBe(true);
        expect([...positions].sort((x, y) => x - y)).toEqual(positions);
      }
    }
  });

  it("gives an agent no Administration, nor any of its screens (CA63)", () => {
    const markup = render("agent", "/inscrits");
    for (const adminOnly of [
      messages.nav.admin,
      messages.nav.dualControl,
      messages.nav.internalAccounts,
      messages.nav.apollo,
      messages.nav.registrySources,
      messages.nav.health,
    ]) {
      expect(markup).not.toContain(`${adminOnly}</a>`);
    }
    expect(currentLinks(markup)).toEqual([messages.nav.signups]);
  });

  it("gives a sub-entry no icon, its label aligned on the entry's in the rail, a row of 36 px", () => {
    const markup = render("admin", "/inscrits");
    const sub = /<a href="\/invitations"[^>]*>(.*?)<\/a>/.exec(markup);
    expect(sub?.[1]).toBe(messages.nav.memberInvitations);
    expect(sub?.[0]).toContain("h-(--spacing-bo-row-h)");
    expect(sub?.[0]).toContain("text-sm");
    expect(sub?.[0]).toContain("lg:pl-(--spacing-nav-sub-indent)");
  });
});
