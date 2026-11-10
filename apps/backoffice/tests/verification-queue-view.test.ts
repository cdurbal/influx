// Queue 4, "vérifications", in words (docs/mvp/08 RG62 to RG64, RG66, CA42 to CA44; 17b §3.7; L2E-21): pure
// functions of src/components/verification-queue-view.ts and queue-view-model.ts, without a browser. The
// server says what is overdue and who holds what; these only word and gather. The list carries no
// handle, no figure and no code: a line has none to word.
import { describe, expect, it } from "vitest";
import type { VerificationQueueEntryRow } from "@influx/contracts/verification";
import {
  QUEUE_ADDRESS,
  filtersOf,
  searchBodyOf,
  splitByDeadline,
  FIRST_PAGE,
} from "../src/components/queue-view-model";
import {
  ageWords,
  networkWords,
  resultsWords,
  sortedColumnOf,
  sortOf,
  VERIFICATION_VIEW_ADDRESS,
  verificationEmptyWords,
  verificationLockWords,
  verificationName,
  verificationNote,
  verificationOwnFilters,
} from "../src/components/verification-queue-view";
import { messages } from "../src/messages/fr";

const t = messages.verificationQueue;
const AS_OF = "2026-11-08T10:00:00.000Z";
const PERSON = "7f1c3c1e-2d0b-4a52-9c5e-0d3b8f7a1b22";

function reader(address: string): (name: string) => string | null {
  const search = new URLSearchParams(address);
  return (name) => search.get(name);
}

function claimOf(
  changes: Partial<VerificationQueueEntryRow["claim"]> = {},
): VerificationQueueEntryRow["claim"] {
  return {
    holder: null,
    claimedAt: null,
    claimExpiresAt: null,
    heldByCaller: false,
    ...changes,
  };
}

describe("L2E-21: the two views of queue 4 and their filters (RG61, RG62, CA43)", () => {
  it("gives each view its own address and the dashboard the three queues, never a mixed screen", () => {
    expect(VERIFICATION_VIEW_ADDRESS).toEqual({
      creators: "/files/verifications-createurs",
      brands: "/files/verifications-marques",
    });
    expect(QUEUE_ADDRESS).toEqual({
      profiles_advertiser: "/files/profils-marque",
      verification_creators: VERIFICATION_VIEW_ADDRESS.creators,
      verification_brands: VERIFICATION_VIEW_ADDRESS.brands,
      verification_disputes: "/files/contestations",
      identity_change_review: "/files/identifiants-modifies",
    });
    expect(t.creators.tableLabel).not.toBe(t.brands.tableLabel);
    expect(t.creators.lead).not.toBe(t.brands.lead);
  });

  it("offers a creator the sort, the level, the network and the re-examination; a brand the sort and the re-examination only", () => {
    const keys = (view: "creators" | "brands") =>
      verificationOwnFilters(view).map((filter) => filter.key);
    expect(keys("creators")).toEqual(["sort", "level", "network", "reexamine"]);
    expect(keys("brands")).toEqual(["sort", "reexamine"]);
    const creators = verificationOwnFilters("creators");
    // the level of a creator is one of two, never the brand's; the sorts of RG62 follow the default
    expect(
      creators
        .find((filter) => filter.key === "level")
        ?.options.map((o) => o.value),
    ).toEqual(["account_verified", "audience_verified"]);
    expect(
      creators
        .find((filter) => filter.key === "sort")
        ?.options.map((o) => o.value),
    ).toEqual(["sla", "level", "network"]);
    expect(creators[0]?.emptyLabel).toBe(t.sorts.age);
    expect(
      verificationOwnFilters("brands")[0]?.options.map((o) => o.value),
    ).toEqual(["sla"]);
  });

  it("keeps in the address the filters a view offers and drops the others, carried to the server in the body", () => {
    const own = verificationOwnFilters("creators");
    const found = filtersOf(
      reader(
        "sort=sla&level=audience_verified&network=tiktok&reexamine=true&holder=me&kind=revision",
      ),
      own,
    );
    expect(found).toEqual({
      holder: "me",
      sort: "sla",
      level: "audience_verified",
      network: "tiktok",
      reexamine: "true",
    });
    // a brand level is dropped, and a creator's sort is no brand's: never sent
    expect(filtersOf(reader("level=brand_verified"), own)).toEqual({});
    expect(
      filtersOf(
        reader("sort=network&level=audience_verified"),
        verificationOwnFilters("brands"),
      ),
    ).toEqual({});
    expect(searchBodyOf(found, {}, FIRST_PAGE, 50)).toEqual({
      ...found,
      limit: 50,
    });
  });

  it("reads the sort in force, the oldest first by default, and marks the column it follows", () => {
    expect(sortOf({}, "creators")).toBe("age");
    expect(sortOf({ sort: "network" }, "creators")).toBe("network");
    // a brand has no network sort: the default
    expect(sortOf({ sort: "network" }, "brands")).toBe("age");
    expect(sortedColumnOf("age")).toBe("submitted");
    expect(sortedColumnOf("sla")).toBe("due");
    expect(sortedColumnOf("level")).toBe("level");
    expect(sortedColumnOf("network")).toBe("network");
    expect(resultsWords(3, {}, "creators")).toBe(
      "3 demandes · triée par ancienneté, la plus ancienne d’abord",
    );
    expect(resultsWords(1, { sort: "sla" }, "brands")).toBe(
      "1 demande · triée par SLA restant",
    );
  });
});

describe("L2E-21: a line in words (RG63, RG64)", () => {
  it("words a network, a brand having none, an unknown code as it is", () => {
    expect(networkWords("instagram")).toBe("Instagram");
    expect(networkWords(null)).toBe(t.noNetwork);
    expect(networkWords("bluesky")).toBe("bluesky");
  });

  it("words the age from the instant of the database, never the browser's clock", () => {
    expect(ageWords({ submittedAt: "2026-11-08T07:48:00.000Z" }, AS_OF)).toBe(
      "2 h 12",
    );
    expect(ageWords({ submittedAt: "2026-11-05T10:00:00.000Z" }, AS_OF)).toBe(
      "3 j",
    );
  });

  it("says « En cours — {prénom} » to a second agent, never a technical error (RG64)", () => {
    expect(verificationLockWords({ claim: claimOf() })).toBe("libre");
    expect(
      verificationLockWords({
        claim: claimOf({
          holder: { accountId: PERSON, displayName: "Marie" },
          claimedAt: AS_OF,
        }),
      }),
    ).toBe("En cours — Marie");
    expect(
      verificationLockWords({
        claim: claimOf({
          holder: { accountId: PERSON, displayName: "Marie" },
          heldByCaller: true,
        }),
      }),
    ).toBe("En cours — vous");
    expect(
      verificationLockWords({
        claim: claimOf({ holder: { accountId: PERSON, displayName: null } }),
      }),
    ).toBe("En cours — un collègue");
  });

  it("writes the alerts and the re-examination under the line, in clear, and nothing when there is none (RG63, RG50)", () => {
    expect(verificationNote({ alerts: [], reexamine: null })).toBeNull();
    const note = verificationNote({
      alerts: ["prior_rejections", "same_handle_elsewhere"],
      reexamine: {
        reasonCode: "network_unreachable",
        reexaminedAt: "2026-11-08T08:00:00.000Z",
      },
    });
    expect(note).toContain(`Alerte : ${t.alerts.prior_rejections}`);
    expect(note).toContain(`Alerte : ${t.alerts.same_handle_elsewhere}`);
    expect(note).toContain("À réexaminer : réseau injoignable, depuis ");
    // the gap between declared and observed exists after the agent typed: no word of it in a list
    expect(note).not.toMatch(/écart|déclaré|observé/i);
  });

  it("names a line by the alias or the trading name, with a word when it has none", () => {
    expect(verificationName({ displayName: "Marlin" }, "creators")).toBe(
      "Marlin",
    );
    expect(verificationName({ displayName: null }, "creators")).toBe(
      t.creators.unnamed,
    );
    expect(verificationName({ displayName: null }, "brands")).toBe(
      t.brands.unnamed,
    );
  });
});

describe("L2E-21: the entries past their deadline, a list of their own, and the empty queue (RG66, CA42, CA44)", () => {
  it("splits a page into the overdue entries and the others, each in the server's order", () => {
    const rows = [
      { id: "a", overdue: true },
      { id: "b", overdue: false },
      { id: "c", overdue: true },
      { id: "d", overdue: false },
    ];
    const { overdue, inTime } = splitByDeadline(rows);
    expect(overdue.map((row) => row.id)).toEqual(["a", "c"]);
    expect(inTime.map((row) => row.id)).toEqual(["b", "d"]);
    expect(splitByDeadline([])).toEqual({ overdue: [], inTime: [] });
    // still decidable and marked: the list says so
    expect(t.overdueNote).toContain("décidables");
  });

  it("tells when the last request was handled, and a queue never handled just says it is empty", () => {
    const counters = (lastDecidedAt: string | null) => ({
      queue: "verification_creators" as const,
      pending: 0,
      oldestCreatedAt: null,
      overdue: 0,
      unclaimed: 0,
      lastDecidedAt,
      policy: {
        decisionMinutes: 480,
        claimTargetMinutes: null,
        escalateAfterMinutes: null,
        businessHours: true,
      },
    });
    expect(
      verificationEmptyWords(counters("2026-11-08T09:48:00.000Z"), AS_OF),
    ).toBe(
      "Aucune demande en attente — la dernière a été traitée il y a 12 min.",
    );
    expect(verificationEmptyWords(counters(null), AS_OF)).toBe(t.empty);
    expect(verificationEmptyWords(null, AS_OF)).toBe(t.empty);
    // an empty queue is no queue in error: the two states are worded apart
    expect(t.empty).not.toBe(messages.queueList.error);
  });
});
