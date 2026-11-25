// L3G-T12 (docs/mvp/10 RG2, RG57; jalons/l3g/modele.md §6, §7; l3g-fiche invariants 9, 10, 12; D84, D38 Q2): the pure parts
// of the settings of the creator search, without a browser. A setting is worded, the switch asks for the opposite of the
// value in force, the thresholds and k are checked against the contract's own bounds and asked with a reason, a refusal of
// the dual control (no peer administrator) is worded, the two actions of the dual control and the causes of AL22, AL23 and
// AL65 have their words, the counters are counts. The rail holds the screen for an admin only. No amount, no tariff.
import {
  dualControlRequestSchema,
  type Alert,
} from "@influx/contracts/backoffice-actions";
import { supplyCountersSchema } from "@influx/contracts/search-settings";
import { describe, expect, it } from "vitest";
import { alertLink, alertText } from "../src/components/alert-words";
import { activePlaceOf, navItemsOf } from "../src/components/bo-nav";
import {
  anonymityRequest,
  countersViewOf,
  facetWords,
  openingRequest,
  requestRefusal,
  settingChangeOf,
  settingWords,
  thresholdsRequest,
} from "../src/components/search-settings-view";
import { messages } from "../src/messages/fr";

const t = messages.searchSettings;

describe("L3G-T12: the requests of the settings", () => {
  it("asks for the opposite of the opening in force, with a reason, as the contract types it", () => {
    expect(openingRequest(false, null)).toEqual({
      ok: false,
      problem: { field: "reason", text: t.problems.reason },
    });
    const opened = openingRequest(false, "founder_decision");
    expect(opened.ok).toBe(true);
    if (opened.ok) {
      expect(dualControlRequestSchema.safeParse(opened.body).success).toBe(
        true,
      );
      expect(opened.body).toMatchObject({
        code: "search.change_setting",
        setting: { key: "is_open_to_advertisers", value: true },
      });
    }
    const closed = openingRequest(true, "abuse_response");
    expect(closed.ok && closed.body).toMatchObject({
      setting: { key: "is_open_to_advertisers", value: false },
    });
  });

  it("checks k between 5 and 50 and the thresholds between 1 and 100 000, and asks nothing for the same value", () => {
    expect(anonymityRequest("4", 10, "founder_decision").ok).toBe(false);
    expect(anonymityRequest("51", 10, "founder_decision").ok).toBe(false);
    expect(anonymityRequest("dix", 10, "founder_decision")).toEqual({
      ok: false,
      problem: { field: "k", text: t.problems.whole },
    });
    expect(anonymityRequest("10", 10, "founder_decision")).toEqual({
      ok: false,
      problem: { field: "k", text: t.problems.unchanged },
    });
    expect(anonymityRequest("12", 10, null).ok).toBe(false);
    const k = anonymityRequest("12", 10, "configuration_error");
    expect(k.ok && dualControlRequestSchema.safeParse(k.body).success).toBe(
      true,
    );

    const current = { publishedProfiles: 30, perTopic: 5 };
    expect(
      thresholdsRequest(
        { publishedProfiles: "0", perTopic: "5" },
        current,
        "founder_decision",
      ).ok,
    ).toBe(false);
    expect(
      thresholdsRequest(
        { publishedProfiles: "30", perTopic: "5" },
        current,
        "founder_decision",
      ).ok,
    ).toBe(false);
    const ok = thresholdsRequest(
      { publishedProfiles: "40", perTopic: "6" },
      current,
      "critical_mass_reached",
    );
    expect(ok.ok && ok.body).toMatchObject({
      code: "search.change_setting",
      setting: {
        key: "critical_mass_thresholds",
        value: { publishedProfiles: 40, perTopic: 6 },
      },
    });
  });

  it("words the refusal of a request: no peer administrator, a value the contract refuses", () => {
    expect(requestRefusal("conflict", ["no_peer_admin"])).toBe(
      messages.dualControl.noPeerAdmin,
    );
    expect(requestRefusal("validation_failed", ["setting.value"])).toBe(
      t.problems.refused,
    );
    expect(requestRefusal("not_found", [])).toBeNull();
  });

  it("words a setting, with no amount, and the two actions of the dual control", () => {
    expect(settingWords({ key: "is_open_to_advertisers", value: false })).toBe(
      "Recherche des marques : fermée",
    );
    expect(
      settingWords({
        key: "critical_mass_thresholds",
        value: { publishedProfiles: 30, perTopic: 5 },
      }),
    ).toContain("30 profils");
    expect(messages.dualControl.actions["search.change_setting"]).toBeTruthy();
    expect(messages.dualControl.actions["search.change_facet"]).toBeTruthy();
    for (const code of [
      "setting_changed",
      "search_opening_changed",
      "config_version_opened",
      "facet_changed",
    ]) {
      expect(messages.dualControl.consequences[code], code).toBeTruthy();
    }
    for (const code of ["critical_mass_reached", "abuse_response"]) {
      expect(messages.dualControl.reasons[code], code).toBeTruthy();
    }
  });

  it("shows the counters as counts, by topic, country and day", () => {
    const view = countersViewOf(
      supplyCountersSchema.parse({
        snapshotOn: "2026-11-21",
        computedAt: "2026-11-21T00:05:00.000Z",
        global: { published: 12, searchable: 9 },
        topics: [{ code: "beauty", published: 4, searchable: 3 }],
        countries: [{ code: "FR", published: 7, searchable: 5 }],
        curve: [{ snapshotOn: "2026-11-20", published: 11, searchable: 8 }],
      }),
    );
    expect(view.global).toContain("12 profils publiés, dont 9");
    expect(view.topics[0]).toMatchObject({ label: "Beauty", published: "4" });
    expect(view.countries[0]?.label).toBe("France");
    expect(view.curve).toHaveLength(1);
  });
});

describe("L3G-T12: the alerts of the search and of queue 9 have their words", () => {
  const alert = (
    code: Alert["code"],
    cause: Alert["cause"],
    count: number,
  ): Alert => ({
    code,
    cause,
    destination: null,
    setting: null,
    count,
    since: null,
  });

  it("words the five causes without falling back on their code, and leads to the right screen", () => {
    const cases: [Alert, string, string][] = [
      [
        alert("AL65", "thresholds_reached", 42),
        "Masse critique atteinte",
        "/reglages/recherche",
      ],
      [
        alert("AL65", "below_while_open", 12),
        "repassés sous le seuil",
        "/reglages/recherche",
      ],
      [alert("AL65", "counters_stale", 30), "30 heures", "/reglages/recherche"],
      [alert("AL22", "k_blocked_share", 2500), "25 %", "/reglages/recherche"],
      [
        alert("AL23", "selection_past_deadline", 2),
        "2 demandes",
        "/files/selections-equipe",
      ],
    ];
    for (const [item, words, href] of cases) {
      const text = alertText(item);
      expect(text, item.cause).toContain(words);
      expect(text).not.toContain(item.cause);
      expect(alertLink(item)?.href).toBe(href);
    }
    expect(alertLink({ code: "AL24" })).toBeNull();
  });

  it("holds the settings screen for an admin only, after Apollo", () => {
    const admin = navItemsOf("admin").find((item) => item.key === "admin");
    const keys = admin?.sections.map((section) => section.key) ?? [];
    expect(keys.indexOf("searchSettings")).toBe(keys.indexOf("apollo") + 1);
    expect(
      navItemsOf("agent").flatMap((item) => item.sections.map((s) => s.key)),
    ).not.toContain("searchSettings");
    expect(activePlaceOf("/reglages/recherche")).toEqual({
      entry: "admin",
      section: "searchSettings",
    });
  });
});

describe("L3G-fix-1: the dual control says the value in force before the value requested (J8)", () => {
  it("J8: the current value comes from the settings read, is null when unread, and a facet is named before its code", () => {
    const settings = [
      { key: "k_anonymity_threshold", value: 8 },
      { key: "is_open_to_advertisers", value: false },
    ] as never;
    const change = settingChangeOf(settings, {
      key: "k_anonymity_threshold",
      value: 12,
    });
    expect(change.current).toBe(t.words.k("8"));
    expect(change.requested).toBe(t.words.k("12"));
    expect(
      settingChangeOf(null, { key: "k_anonymity_threshold", value: 12 })
        .current,
    ).toBeNull();
    expect(
      settingChangeOf([] as never, { key: "k_anonymity_threshold", value: 12 })
        .current,
    ).toBeNull();
    expect(facetWords("F1")).toBe(
      `${messages.identifiedSearch.facets.topic} (F1)`,
    );
    expect(facetWords("F11")).toBe(
      `${messages.identifiedSearch.facets.formats} (F11)`,
    );
    expect(facetWords("F2")).toBe("F2");
  });
});
