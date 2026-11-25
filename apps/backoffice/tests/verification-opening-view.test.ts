// The origin of a request of queue 4 and the grant on the login address (docs/mvp/06 RG51; jalons/l2f/
// modele.md §6; D83 A and A-bis; L2F-20): pure functions of src/components/verification-opening-view.ts and
// of the grant of src/components/verification-decision-view.ts, without a browser. The database reads the
// login address and decides whether it proves the domain; these only word the origin, offer the choice when
// the base says yes, and say why a refusal came, as a word and never the address.
import {
  verificationOpenResponseSchema,
  type VerificationOpenResponse,
  type VerificationOpening,
  type VerificationRegistrySourceRow,
} from "@influx/contracts/verification";
import type { RelayResult } from "@influx/web-platform/relay-client";
import { describe, expect, it } from "vitest";
import {
  brandGrantByLoginCheck,
  EMPTY_DRAFT,
  refusalOf,
} from "../src/components/verification-decision-view";
import {
  loginProofOffered,
  openedByWords,
  openingLines,
} from "../src/components/verification-opening-view";
import { messages } from "../src/messages/fr";

const b = messages.verificationReview.brand;
const AS_OF = "2026-11-08T10:00:00.000Z";
const ME = "7f1c3c1e-2d0b-4a52-9c5e-0d3b8f7a1b22";
const TOKEN = "b".repeat(64);
const SOURCE = "aaaaaaaa-2222-4333-8444-555555555551";
const SOURCES: VerificationRegistrySourceRow[] = [
  {
    id: SOURCE,
    sourceType: "e_justice",
    countryCode: "BE",
    subdivisionCode: null,
    name: "e-Justice Portal",
    url: "https://e-justice.europa.eu/",
    checkedOn: "2026-11-07",
  },
];
const minutes = (count: number) =>
  new Date(Date.parse(AS_OF) + count * 60_000).toISOString();

function viewOf(
  opening: VerificationOpening,
  level: "brand_verified" | "account_verified" = "brand_verified",
): VerificationOpenResponse {
  return verificationOpenResponseSchema.parse({
    asOf: AS_OF,
    outcome: "claimed",
    reviewToken: TOKEN,
    entry: {
      id: "11111111-2222-4333-8444-555555555555",
      level,
      networkCode: level === "brand_verified" ? null : "instagram",
      status: "pending",
      submittedAt: minutes(-90),
      slaDueAt: minutes(120),
      escalateAt: minutes(600),
      overdue: false,
      claim: {
        holder: { accountId: ME, displayName: "Lou" },
        claimedAt: minutes(-2),
        claimExpiresAt: minutes(28),
        heldByCaller: true,
      },
      lastForcedRelease: null,
      reexamine: null,
      decision: null,
    },
    account: {
      id: ME,
      countryCode: "BE",
      preferredLanguage: "fr",
      owner: null,
    },
    dossier: {
      codeExpiresAt: minutes(60),
      creator: null,
      brand: {
        tradeName: "Maison Test",
        websiteDomain: "maison-test.example",
        internalDetails: null,
        registrySources: SOURCES,
      },
      evidence: [],
      history: [],
      badges: [],
      alerts: [],
      opening,
    },
    reasons: [],
  });
}

const MEMBER: VerificationOpening = {
  openedBy: "member",
  reasonCode: null,
  comment: null,
  loginAddressEligible: false,
};
const AGENT: VerificationOpening = {
  openedBy: "agent",
  reasonCode: "existing_client",
  comment: "Met at the fair",
  loginAddressEligible: true,
};

type Failed = Exclude<RelayResult<unknown>, { kind: "ok" }>;
const failed = (code: string, issues: string[] = []): Failed =>
  ({ kind: "failed", code, issues }) as Failed;

describe("L2F-20: the origin of a request, in the list and in the dossier", () => {
  it("writes who opened the request in the list (the member, or the team)", () => {
    expect(openedByWords({ openedBy: "member" })).toBe(
      messages.verificationQueue.openedBy.member,
    );
    expect(openedByWords({ openedBy: "agent" })).toBe(
      messages.verificationQueue.openedBy.agent,
    );
  });

  it("shows the reason and the internal comment of an agent's opening, and only the origin of a member's", () => {
    const agent = openingLines(AGENT);
    expect(agent.origin).toBe(messages.verificationReview.opening.agent);
    expect(agent.reason).toContain("Client existant");
    expect(agent.comment).toBe("Met at the fair");
    expect(openingLines(MEMBER)).toEqual({
      origin: messages.verificationReview.opening.member,
      reason: null,
      comment: null,
    });
  });
});

describe("L2F-20: the grant on the login address (D83 A-bis)", () => {
  it("offers the proof by the login address only for a brand whose base says the address proves the domain", () => {
    expect(loginProofOffered(viewOf(AGENT))).toBe(true);
    expect(loginProofOffered(viewOf(MEMBER))).toBe(false);
    expect(loginProofOffered(viewOf(AGENT, "account_verified"))).toBe(false);
  });

  it("types nothing about the domain: the register consulted, chosen among the sources, and the comment", () => {
    expect(brandGrantByLoginCheck(EMPTY_DRAFT, TOKEN, SOURCES)).toMatchObject({
      ok: false,
      problem: { field: "registry" },
    });
    expect(brandGrantByLoginCheck(EMPTY_DRAFT, TOKEN, [])).toMatchObject({
      ok: false,
      problem: { field: "registry", text: b.problems.noSource },
    });
    const checked = brandGrantByLoginCheck(
      { ...EMPTY_DRAFT, registrySourceId: SOURCE, internalComment: " ok " },
      TOKEN,
      SOURCES,
    );
    expect(checked).toEqual({
      ok: true,
      body: {
        reviewToken: TOKEN,
        registrySourceId: SOURCE,
        internalComment: "ok",
      },
    });
    // no domain, channel nor code leaves with this grant
    const keys = Object.keys(checked.ok ? checked.body : {});
    expect(keys).not.toContain("observedCode");
    expect(keys).not.toContain("observedDomain");
    expect(keys).not.toContain("observedChannel");
  });

  it("says why the login address does not prove the domain, as a word on the proof choice and never the address", () => {
    for (const why of ["unverified", "consumer_domain", "other_domain"]) {
      expect(
        refusalOf(
          failed("conflict", ["login_address_ineligible", why]),
          "brand",
        ),
      ).toEqual({
        kind: "text",
        text: b.problems.loginIneligible[why],
        field: "proof",
      });
    }
    expect(b.problems.loginIneligible.consumer_domain).toMatch(/grand public/u);
    for (const text of Object.values(b.problems.loginIneligible)) {
      expect(text).not.toMatch(/@/u);
    }
  });
});
