// « Lancer la vérification » on the record of a member in words and in checks (docs/mvp/06 RG51; 15 RG36;
// jalons/l2f/modele.md §5, §6; D83 A; L2F-20): pure functions of src/components/account-opening-view.ts,
// without a browser. The database holds the rules (the level, the reason, the account, the block, the
// takeover); these only word the rows, pre-check what was typed and say what the member will receive.
import {
  OPENING_REASON_CODES,
  type AccountOpeningRow,
} from "@influx/contracts/verification";
import { describe, expect, it } from "vitest";
import {
  asksInternalDetails,
  COUNTRY_OPTIONS,
  EMPTY_OPENING_DRAFT,
  isBlockedBrand,
  openedNotice,
  OPENING_REASONS,
  openingOutcome,
  openingRefusal,
  queueAddressOf,
  recapLines,
  requestWords,
  sortedTargets,
  targetName,
} from "../src/components/account-opening-view";
import { messages } from "../src/messages/fr";

const t = messages.accountOpening;
const LINE = "11111111-2222-4333-8444-555555555551";
const REQUEST = "11111111-2222-4333-8444-555555555559";

const line = (changes: Partial<AccountOpeningRow> = {}): AccountOpeningRow => ({
  socialAccountId: LINE,
  networkCode: "instagram",
  level: "account_verified",
  request: null,
  brand: null,
  ...changes,
});

const brand = (
  details: boolean,
  domain = true,
  changes: Partial<AccountOpeningRow> = {},
): AccountOpeningRow => ({
  socialAccountId: null,
  networkCode: null,
  level: "brand_verified",
  request: null,
  brand: { hasWebsiteDomain: domain, hasInternalDetails: details },
  ...changes,
});

const DRAFT = { ...EMPTY_OPENING_DRAFT, reasonCode: "existing_client" };

describe("L2F-20: what the opening offers, in words", () => {
  it("names a line by its level and its network, a brand by its badge, and puts the lines first", () => {
    expect(targetName(line())).toBe("Compte vérifié · Instagram");
    expect(targetName(brand(true))).toBe("Marque vérifiée");
    const sorted = sortedTargets([
      brand(true),
      line({ networkCode: "tiktok", socialAccountId: "x2" }),
      line(),
    ]);
    expect(sorted.map((row) => row.level)).toEqual([
      "account_verified",
      "account_verified",
      "brand_verified",
    ]);
    expect(sorted[0]?.networkCode).toBe("instagram");
  });

  it("says the request already open and its origin, never offers « Audience vérifiée », and sends the agent to the right view of queue 4", () => {
    expect(requestWords(line())).toBe(t.noRequest);
    const open = {
      id: REQUEST,
      status: "pending",
      openedBy: "member",
    } as const;
    expect(requestWords(line({ request: open }))).toBe(
      t.request.member?.pending,
    );
    expect(
      requestWords(line({ request: { ...open, openedBy: "agent" } })),
    ).toBe(t.request.agent?.pending);
    expect(requestWords(line({ request: { ...open, status: "draft" } }))).toBe(
      t.request.member?.draft,
    );
    expect(queueAddressOf(line(), REQUEST)).toBe(
      `/files/verifications-createurs/${REQUEST}`,
    );
    expect(queueAddressOf(brand(true), REQUEST)).toBe(
      `/files/verifications-marques/${REQUEST}`,
    );
    // the rows hold two levels only: the third is never a target of this block
    expect(JSON.stringify(t).includes("audience_verified")).toBe(false);
  });

  it("offers the reasons of the closed list, written, in the order of the table", () => {
    expect(OPENING_REASONS).toEqual([...OPENING_REASON_CODES]);
    for (const code of OPENING_REASONS) {
      expect(t.reasons[code]).toBeTruthy();
    }
  });
});

describe("L2F-20: what the agent typed is checked as the contract and the database check it", () => {
  it("asks a reason of the list, and a comment for `other` only, 1 000 characters at most", () => {
    expect(openingOutcome(line(), EMPTY_OPENING_DRAFT)).toMatchObject({
      ok: false,
      field: "reason",
    });
    expect(
      openingOutcome(line(), { ...DRAFT, reasonCode: "friendship" }),
    ).toMatchObject({ ok: false, field: "reason" });
    expect(
      openingOutcome(line(), { ...DRAFT, reasonCode: "other", comment: "  " }),
    ).toEqual({ ok: false, field: "comment", error: t.commentMissing });
    expect(
      openingOutcome(line(), { ...DRAFT, comment: "x".repeat(1001) }),
    ).toMatchObject({ ok: false, field: "comment" });
    expect(openingOutcome(line(), DRAFT)).toEqual({
      ok: true,
      body: {
        level: "account_verified",
        socialAccountId: LINE,
        openingReasonCode: "existing_client",
      },
    });
    expect(
      openingOutcome(line(), {
        ...DRAFT,
        reasonCode: "other",
        comment: "  Met at the trade fair  ",
      }),
    ).toMatchObject({
      ok: true,
      body: {
        openingReasonCode: "other",
        openingComment: "Met at the trade fair",
      },
    });
  });

  it("asks the three fields of the internal block of a brand that holds none, together, and none of a brand that holds one", () => {
    expect(asksInternalDetails(brand(false))).toBe(true);
    expect(asksInternalDetails(brand(true))).toBe(false);
    expect(openingOutcome(brand(true), DRAFT)).toEqual({
      ok: true,
      body: {
        level: "brand_verified",
        socialAccountId: null,
        openingReasonCode: "existing_client",
      },
    });
    expect(openingOutcome(brand(false), DRAFT)).toEqual({
      ok: false,
      field: "legalName",
      error: t.legalNameInvalid,
    });
    const named = { ...DRAFT, legalName: " Maison Dupont SAS " };
    expect(openingOutcome(brand(false), named)).toMatchObject({
      field: "country",
    });
    const countried = { ...named, registrationCountryCode: "FR" };
    expect(openingOutcome(brand(false), countried)).toMatchObject({
      field: "number",
    });
    expect(
      openingOutcome(brand(false), {
        ...countried,
        registrationNumber: " 552 081 317 ",
      }),
    ).toEqual({
      ok: true,
      body: {
        level: "brand_verified",
        socialAccountId: null,
        openingReasonCode: "existing_client",
        legalName: "Maison Dupont SAS",
        registrationCountryCode: "FR",
        registrationNumber: "552 081 317",
      },
    });
    // a country is chosen among the codes of the contract, never typed
    expect(
      openingOutcome(brand(false), {
        ...countried,
        registrationCountryCode: "ZZ",
        registrationNumber: "1",
      }),
    ).toMatchObject({ ok: false, field: "country" });
    expect(COUNTRY_OPTIONS.some((country) => country.code === "FR")).toBe(true);
  });

  it("blocks a brand without a domain, and says nothing of a creator's line", () => {
    expect(isBlockedBrand(brand(true, false))).toBe(true);
    expect(isBlockedBrand(brand(true))).toBe(false);
    expect(isBlockedBrand(line())).toBe(false);
  });
});

describe("L2F-20: what the member receives, and what comes back", () => {
  it("says what the e-mail holds before the gesture, and that it carries no code, link or figure", () => {
    const creator = recapLines(line()).join(" ");
    expect(creator).toContain("Instagram");
    expect(creator).toContain(t.recapNoCode);
    expect(creator).toContain(t.recapInternal);
    expect(recapLines(brand(true))[0]).toBe(t.recapBrand);
    expect(creator).not.toMatch(/INFLUX-[A-Z0-9]{8}/u);
  });

  it("says created, or taken over (never doubled), and the refusals as sentences by their issue", () => {
    expect(openedNotice(line(), true)).toBe(
      t.created("Compte vérifié · Instagram"),
    );
    expect(openedNotice(line(), false)).toBe(
      t.takenOver("Compte vérifié · Instagram"),
    );
    for (const issue of [
      "account_unavailable",
      "already_verified",
      "rejection_cap",
      "retry_after",
      "website_domain_required",
      "internal_details_required",
      "internal_details_present",
      "invalid_internal_details",
      "invalid_opening_comment",
    ]) {
      expect(openingRefusal("conflict", [issue])).toBe(t.refusals[issue]);
    }
    expect(openingRefusal("not_found", [])).toBe(t.notFound);
    expect(openingRefusal("internal_error", [])).toBeNull();
    expect(openingRefusal("conflict", ["something_else"])).toBeNull();
  });
});
