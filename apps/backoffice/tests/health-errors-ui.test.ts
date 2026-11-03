// J9S-7 (PL-03; 02 §20.5, "Erreurs du navigateur"): the message of a browser error is free text of
// a member's browser. It is shown with "source navigateur, texte non vérifié", as inert text: a URL
// and markup stay text, no link, no `href`, no element made of it. Server rendering, no browser.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type {
  OpsErrorGroup,
  OpsOccurrence,
} from "@influx/contracts/backoffice-ops";
import { GroupRows, OccurrenceRows } from "../src/components/HealthErrors";
import { messages } from "../src/messages/fr";

const HOSTILE =
  'Click <a href="https://evil.example/x">here</a> <img src=x onerror=alert(1)> https://evil.example/y';
const ESCAPED_TAG = "&lt;a href=&quot;https://evil.example/x&quot;&gt;";

function group(source: OpsErrorGroup["source"]): OpsErrorGroup {
  return {
    id: "6f1c1c6e-2d57-4a43-9d0e-5b9f6a7d3c11",
    source,
    service: source === "browser" ? "web" : "api",
    errorType: "TypeError",
    message: HOSTILE,
    route: null,
    status: "new",
    occurrenceCount: 3,
    regressionCount: 0,
    firstSeenAt: "2026-10-31T10:00:00.000Z",
    lastSeenAt: "2026-10-31T10:05:00.000Z",
    lastRegressedAt: null,
    firstVersion: "1.0.0",
    lastVersion: "1.0.0",
    regression: false,
  };
}

const occurrence: OpsOccurrence = {
  occurredAt: "2026-10-31T10:05:00.000Z",
  service: "web",
  version: "1.0.0",
  route: null,
  requestId: null,
  accountId: null,
  message: HOSTILE,
  stack: null,
  userAgentSummary: null,
};

function inTable(row: ReturnType<typeof createElement>): string {
  return renderToStaticMarkup(
    createElement("table", null, createElement("tbody", null, row)),
  );
}

function groupMarkup(source: OpsErrorGroup["source"]): string {
  return inTable(
    createElement(GroupRows, {
      group: group(source),
      open: false,
      onToggle: () => {},
      refresh: 0,
    }),
  );
}

describe("browser error text (J9S-7)", () => {
  it("J9S-7: a browser group says its text is unverified", () => {
    expect(groupMarkup("browser")).toContain(messages.health.errors.unverified);
    expect(messages.health.errors.unverified).toBe(
      "source navigateur, texte non vérifié",
    );
  });

  it("J9S-7: a server group does not carry the note", () => {
    expect(groupMarkup("server")).not.toContain(
      messages.health.errors.unverified,
    );
  });

  it("J9S-7: a URL and markup in the message of a group stay inert text", () => {
    const markup = groupMarkup("browser");
    expect(markup).toContain(ESCAPED_TAG);
    expect(markup).not.toContain("<a ");
    expect(markup).not.toContain("<img");
    expect(markup).not.toMatch(/<[^>]*href=/);
  });

  it("J9S-7: the same holds for the message of an occurrence, note included", () => {
    const markup = inTable(
      createElement(OccurrenceRows, { occurrence, source: "browser" }),
    );
    expect(markup).toContain(messages.health.errors.unverified);
    expect(markup).toContain(ESCAPED_TAG);
    expect(markup).not.toContain("<a ");
    expect(markup).not.toContain("<img");
    expect(markup).not.toMatch(/<[^>]*href=/);
  });

  it("J9S-7: an occurrence of a server group has no note", () => {
    const markup = inTable(
      createElement(OccurrenceRows, { occurrence, source: "server" }),
    );
    expect(markup).not.toContain(messages.health.errors.unverified);
  });

  it("PLS-7: a browser occurrence flags its stack and its page as unverified", () => {
    const note = messages.health.errors.unverified;
    const markup = inTable(
      createElement(OccurrenceRows, {
        occurrence: {
          ...occurrence,
          route: "/fr/<b>x</b>",
          stack: "at f (a.js:1)",
        },
        source: "browser",
      }),
    );
    // message, page, stack
    expect(markup.split(note).length - 1).toBe(3);
    expect(markup).not.toMatch(/<[^>]*href=/);
  });

  it("PLS-7: a server occurrence flags neither its stack nor its route", () => {
    const markup = inTable(
      createElement(OccurrenceRows, {
        occurrence: { ...occurrence, route: "/v1/x", stack: "at f (a.js:1)" },
        source: "server",
      }),
    );
    expect(markup).not.toContain(messages.health.errors.unverified);
  });

  it("PLS-7: a browser group flags its page, a server group does not", () => {
    const note = messages.health.errors.unverified;
    const withRoute = (source: OpsErrorGroup["source"]) =>
      inTable(
        createElement(GroupRows, {
          group: { ...group(source), route: "/fr/profil" },
          open: false,
          onToggle: () => {},
          refresh: 0,
        }),
      );
    expect(withRoute("browser").split(note).length - 1).toBe(2);
    expect(withRoute("server")).not.toContain(note);
  });
});
