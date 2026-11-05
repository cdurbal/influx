// The list of a queue in words and in the address bar (docs/mvp/15 RG27 C2 C5, RG28, RG32, RG33,
// RG119, RG121; 17b §2.2; L2C-16): pure functions of src/components/queue-view-model.ts, without a
// browser. The server says what is overdue and who holds what; these only word and gather.
import { describe, expect, it } from "vitest";
import type {
  QueueCounters,
  QueueEntryRow,
} from "@influx/contracts/backoffice-queues";
import {
  addressOf,
  chipText,
  chipWords,
  counterWords,
  dueWords,
  durationWords,
  emptyWords,
  escalatedCount,
  filtersOf,
  lockWords,
  pagingOf,
  policyLine,
  searchBodyOf,
  rowStateOf,
  shortcutOf,
  steppedIndex,
  summaryLine,
  type OwnFilter,
} from "../src/components/queue-view-model";
import { messages } from "../src/messages/fr";

const OWN: readonly OwnFilter[] = [
  {
    key: "kind",
    label: "Origine",
    options: [
      { value: "submission", label: "Première soumission" },
      { value: "revision", label: "Modification" },
    ],
  },
];
const AS_OF = "2026-11-04T10:00:00.000Z";
const PERSON = "7f1c3c1e-2d0b-4a52-9c5e-0d3b8f7a1b22";

function reader(address: string): (name: string) => string | null {
  const search = new URLSearchParams(address);
  return (name) => search.get(name);
}

type Facts = Pick<
  QueueEntryRow,
  "overdue" | "claim" | "slaDueAt" | "escalateAt"
>;

function row(changes: Partial<Facts> = {}): Facts {
  return {
    overdue: false,
    slaDueAt: "2026-11-04T12:05:00.000Z",
    escalateAt: null,
    claim: {
      holder: null,
      claimedAt: null,
      claimExpiresAt: null,
      heldByCaller: false,
    },
    ...changes,
  };
}

const COUNTERS: QueueCounters = {
  queue: "profiles_advertiser",
  pending: 7,
  oldestCreatedAt: "2026-11-04T07:50:00.000Z",
  overdue: 2,
  unclaimed: 1,
  lastDecidedAt: "2026-11-04T09:48:00.000Z",
  policy: {
    decisionMinutes: 480,
    claimTargetMinutes: 240,
    escalateAfterMinutes: 960,
    businessHours: true,
  },
};

describe("RG121: the filters the address bar may carry", () => {
  it("keeps the valid common filters and those of the queue, nothing else", () => {
    expect(
      filtersOf(
        reader(
          "overdue=true&holder=free&owner=none&alert=true&kind=revision&x=1",
        ),
        OWN,
      ),
    ).toEqual({
      overdue: "true",
      holder: "free",
      owner: "none",
      alert: "true",
      kind: "revision",
    });
  });

  it("drops a value the screen does not know, and keeps a colleague named by identifier", () => {
    expect(
      filtersOf(
        reader(
          `overdue=yes&holder=everyone&owner=${PERSON}&kind=other&alert=false`,
        ),
        OWN,
      ),
    ).toEqual({ owner: PERSON });
    expect(filtersOf(reader(`holder=${PERSON}`), OWN)).toEqual({
      holder: PERSON,
    });
    expect(filtersOf(reader("holder=me"), OWN)).toEqual({ holder: "me" });
  });

  it("writes the address back with codes only, the bare path when no filter is active", () => {
    expect(addressOf("/files/profils-marque", {})).toBe(
      "/files/profils-marque",
    );
    expect(
      addressOf("/files/profils-marque", { overdue: "true", kind: "revision" }),
    ).toBe("/files/profils-marque?overdue=true&kind=revision");
  });

  it("carries the period as days and the page as a number and a cursor, in the address (L2C 18c)", () => {
    expect(
      filtersOf(reader("from=2026-11-01&to=2026-11-05&kind=revision"), OWN),
    ).toEqual({ from: "2026-11-01", to: "2026-11-05", kind: "revision" });
    expect(filtersOf(reader("from=yesterday&to=2026-11-5"), OWN)).toEqual({});
    expect(chipWords("to", "2026-11-05", OWN)).toEqual({
      name: messages.queueList.periodTo,
      value: "05/11/2026",
    });
    expect(pagingOf(reader("page=3&cursor=AbC_-9"))).toEqual({
      page: 3,
      cursor: "AbC_-9",
    });
    expect(pagingOf(reader("page=12&cursor=x"))).toEqual({
      page: 12,
      cursor: "x",
    });
    // a number alone, a cursor alone, page 1 or 0, a malformed value: the first page
    for (const query of [
      "page=3",
      "cursor=abc",
      "page=1&cursor=abc",
      "page=0&cursor=abc",
      "page=2x&cursor=abc",
      "page=2&cursor=a%3Ab",
      `page=2&cursor=${"a".repeat(301)}`,
    ]) {
      expect(pagingOf(reader(query)), query).toEqual({
        page: 1,
        cursor: null,
      });
    }
    expect(
      addressOf(
        "/files/profils-marque",
        { kind: "revision", from: "2026-11-01" },
        { page: 2, cursor: "AbC" },
      ),
    ).toBe(
      "/files/profils-marque?kind=revision&from=2026-11-01&page=2&cursor=AbC",
    );
  });

  it("sends the filters, the period as instants and the cursor in a body, never the days (L2C 18c)", () => {
    expect(
      searchBodyOf(
        { overdue: "true", from: "2026-11-01", to: "2026-11-05" },
        { from: "2026-10-31T23:00:00.000Z", to: "2026-11-05T22:59:59.999Z" },
        { page: 2, cursor: "AbC" },
        50,
      ),
    ).toEqual({
      overdue: "true",
      from: "2026-10-31T23:00:00.000Z",
      to: "2026-11-05T22:59:59.999Z",
      cursor: "AbC",
      limit: 50,
    });
    expect(searchBodyOf({}, {}, { page: 1, cursor: null }, 50)).toEqual({
      limit: 50,
    });
  });

  it("says each active filter in words, for its chip (17b §4.2)", () => {
    expect(chipWords("overdue", "true", OWN)).toEqual({
      name: messages.queueList.overdueOnly,
      value: "",
    });
    expect(chipText(messages.queueList.overdueOnly, "")).toBe(
      messages.queueList.overdueOnly,
    );
    const words = chipWords("kind", "revision", OWN);
    expect(chipText(words.name, words.value)).toBe("Origine : Modification");
    expect(chipWords("holder", PERSON, OWN).value).toBe(
      messages.queueList.holderOther,
    );
  });
});

describe("17b §2.2: the durations, the counters and the empty state", () => {
  it("words a duration in minutes, hours, then days from 48 h, never negative", () => {
    expect(durationWords(0)).toBe("0 min");
    expect(durationWords(12)).toBe("12 min");
    expect(durationWords(60)).toBe("1 h");
    expect(durationWords(192)).toBe("3 h 12");
    expect(durationWords(125)).toBe("2 h 05");
    expect(durationWords(26 * 60)).toBe("26 h");
    expect(durationWords(3 * 24 * 60 + 4 * 60)).toBe("3 j 4 h");
    expect(durationWords(2 * 24 * 60)).toBe("2 j");
    expect(durationWords(-5)).toBe("0 min");
  });

  it("gives the head banner: volume, age of the oldest, overdue, unclaimed, from the database instant", () => {
    expect(counterWords(COUNTERS, AS_OF)).toEqual([
      "7 entrées en attente",
      "plus ancienne : 2 h 10",
      "hors délai : 2",
      "sans preneur : 1",
    ]);
    expect(
      counterWords(
        { ...COUNTERS, pending: 1, oldestCreatedAt: null },
        AS_OF,
      ).slice(0, 2),
    ).toEqual(["1 entrée en attente", "plus ancienne : —"]);
  });

  it("recalls the delay of the queue in clear, as data (RG38)", () => {
    expect(policyLine(COUNTERS)).toBe(
      "Délai de décision : 8 h ouvrées · Objectif de prise en charge : 4 h ouvrées",
    );
    expect(
      policyLine({
        ...COUNTERS,
        policy: {
          ...COUNTERS.policy,
          claimTargetMinutes: null,
          businessHours: false,
        },
      }),
    ).toBe("Délai de décision : 8 h en continu");
  });

  it("says how long ago the last entry was handled when the queue is empty (RG32), and nothing else when unknown", () => {
    expect(emptyWords(COUNTERS, AS_OF)).toBe(
      "Aucune entrée en attente — la dernière a été traitée il y a 12 min.",
    );
    expect(emptyWords({ ...COUNTERS, lastDecidedAt: null }, AS_OF)).toBe(
      messages.queueList.empty,
    );
    expect(emptyWords(null, AS_OF)).toBe(messages.queueList.empty);
  });

  it("gives the dashboard line of a queue and counts the entries past the threshold of age (RG7)", () => {
    expect(summaryLine(COUNTERS, AS_OF)).toBe(
      "Profils marque à valider : 7 en attente · plus ancienne : 2 h 10 · hors délai : 2 · sans preneur : 1",
    );
    const past = row({ overdue: true, escalateAt: "2026-11-04T09:00:00.000Z" });
    const before = row({
      overdue: true,
      escalateAt: "2026-11-04T11:00:00.000Z",
    });
    expect(
      escalatedCount({
        asOf: AS_OF,
        items: [past, before, row({ overdue: true })],
        nextCursor: null,
      }),
    ).toEqual({ count: 1, atLeast: false });
    expect(
      escalatedCount({ asOf: AS_OF, items: [past], nextCursor: "abc" }),
    ).toEqual({ count: 1, atLeast: true });
  });
});

describe("15 RG27, RG119: the state, the deadline and the lock of a row", () => {
  const holder = { accountId: PERSON, displayName: "Marie D." };
  const claimedAt = "2026-11-04T09:42:00.000Z";

  it("gives a row one state: overdue first, then held, else free", () => {
    expect(rowStateOf(row())).toBe("free");
    expect(rowStateOf(row({ overdue: true }))).toBe("overdue");
    expect(
      rowStateOf(
        row({
          claim: {
            holder,
            claimedAt,
            claimExpiresAt: AS_OF,
            heldByCaller: false,
          },
        }),
      ),
    ).toBe("held");
    expect(
      rowStateOf(
        row({
          overdue: true,
          claim: {
            holder: null,
            claimedAt,
            claimExpiresAt: AS_OF,
            heldByCaller: true,
          },
        }),
      ),
    ).toBe("overdue");
  });

  it("writes an overdue entry as such, with its duration; a late one is still a deadline (C5, C8)", () => {
    const late = dueWords(
      row({ overdue: true, slaDueAt: "2026-11-04T06:48:00.000Z" }),
      AS_OF,
    );
    expect(late.overdue).toBe(true);
    expect(late.text).toBe("HORS DÉLAI depuis 3 h 12");
    expect(dueWords(row(), AS_OF)).toMatchObject({
      overdue: false,
      text: "dans 2 h 05",
    });
  });

  it("names the holder of the lock and the hour, never an identifier (C2)", () => {
    expect(lockWords(row())).toBe("libre");
    const named = lockWords(
      row({
        claim: {
          holder,
          claimedAt,
          claimExpiresAt: claimedAt,
          heldByCaller: false,
        },
      }),
    );
    expect(named).toContain("Marie D. depuis ");
    expect(named).not.toContain(PERSON);
    expect(
      lockWords(
        row({
          claim: {
            holder,
            claimedAt,
            claimExpiresAt: claimedAt,
            heldByCaller: true,
          },
        }),
      ),
    ).toContain("Vous depuis ");
    expect(
      lockWords(
        row({
          claim: {
            holder: { accountId: PERSON, displayName: null },
            claimedAt: null,
            claimExpiresAt: null,
            heldByCaller: false,
          },
        }),
      ),
    ).toBe(messages.queueList.lockUnknown);
  });
});

describe("17b §2.2: the keys of the list", () => {
  const body = { tagName: "BODY", isContentEditable: false };
  const keys = (key: string, changes: object = {}) =>
    shortcutOf({
      key,
      ctrlKey: false,
      metaKey: false,
      altKey: false,
      target: body,
      ...changes,
    });

  it("reads ‹j›, ‹k› and ‹?› outside a field", () => {
    expect(keys("j")).toBe("next");
    expect(keys("k")).toBe("previous");
    expect(keys("?")).toBe("help");
    expect(keys("x")).toBeNull();
    expect(keys("Enter")).toBeNull();
  });

  it("never takes a key from a field, an editable text or a modified key", () => {
    for (const tagName of ["INPUT", "SELECT", "TEXTAREA"]) {
      expect(
        keys("j", { target: { tagName, isContentEditable: false } }),
      ).toBeNull();
    }
    expect(
      keys("j", { target: { tagName: "DIV", isContentEditable: true } }),
    ).toBeNull();
    expect(keys("j", { ctrlKey: true })).toBeNull();
    expect(keys("k", { metaKey: true })).toBeNull();
    expect(keys("?", { altKey: true })).toBeNull();
  });

  it("moves between the rows without leaving them, from the first one when none has the focus", () => {
    expect(steppedIndex("next", -1, 3)).toBe(0);
    expect(steppedIndex("previous", -1, 3)).toBe(0);
    expect(steppedIndex("next", 0, 3)).toBe(1);
    expect(steppedIndex("next", 2, 3)).toBe(2);
    expect(steppedIndex("previous", 2, 3)).toBe(1);
    expect(steppedIndex("previous", 0, 3)).toBe(0);
    expect(steppedIndex("next", 0, 0)).toBe(-1);
  });
});
