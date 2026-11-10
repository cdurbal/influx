// The decision screen of a brand's verification request in words, checks and keys (docs/mvp/06 RG46 to RG52,
// RG61, CA28, CA29; 08 RG56 to RG59; 17b §3.7; jalons/l2e/modele.md §4, §5; L2E-23): pure functions of
// src/components/verification-decision-view.ts, without a browser. The database compares the code, the
// domain and the source, and says who holds the request; these only gather what the agent TYPED (nothing
// is ever pre-filled, the register is chosen among the sources the dossier served and never typed) and word
// what a refusal means.
import {
  verificationOpenResponseSchema,
  VERIFICATION_REEXAMINE_REASON_CODES,
  type VerificationOpenResponse,
  type VerificationReasonRow,
  type VerificationRegistrySourceRow,
} from "@influx/contracts/verification";
import type { RelayResult } from "@influx/web-platform/relay-client";
import { describe, expect, it } from "vitest";
import {
  brandGrantCheck,
  closedLines,
  EMPTY_DRAFT,
  grantedNotice,
  isBrand,
  modeOf,
  reexamineReasonsOf,
  reexaminedNotice,
  refusalOf,
  registryLinkOf,
  registrySourceWords,
  rejectCheck,
  rejectedNotice,
  titleOf,
  whoOf,
  type Draft,
} from "../src/components/verification-decision-view";
import { messages } from "../src/messages/fr";

const t = messages.verificationReview;
const b = t.brand;
const AS_OF = "2026-11-08T10:00:00.000Z";
const ME = "7f1c3c1e-2d0b-4a52-9c5e-0d3b8f7a1b22";
const TOKEN = "b".repeat(64);
const REQUEST = "11111111-2222-4333-8444-555555555555";
const EUROPE = "aaaaaaaa-2222-4333-8444-555555555551";
const GLEIF = "aaaaaaaa-2222-4333-8444-555555555552";
const minutes = (count: number) =>
  new Date(Date.parse(AS_OF) + count * 60_000).toISOString();

const SOURCES: VerificationRegistrySourceRow[] = [
  {
    id: EUROPE,
    sourceType: "e_justice",
    countryCode: "BE",
    subdivisionCode: null,
    name: "e-Justice Portal, Find a company (BRIS)",
    url: "https://e-justice.europa.eu/489/EN/business_registers__search_for_a_company_in_the_eu",
    checkedOn: "2026-11-07",
  },
  {
    id: GLEIF,
    sourceType: "gleif",
    countryCode: null,
    subdivisionCode: null,
    name: "GLEIF, LEI search",
    url: "https://search.gleif.org/",
    checkedOn: "2026-11-07",
  },
];

function brandViewOf(
  changes: {
    status?: VerificationOpenResponse["entry"]["status"];
    outcome?: VerificationOpenResponse["outcome"];
    token?: string | null;
    sources?: VerificationRegistrySourceRow[];
  } = {},
): VerificationOpenResponse {
  const outcome = changes.outcome ?? "claimed";
  return verificationOpenResponseSchema.parse({
    asOf: AS_OF,
    outcome,
    reviewToken: "token" in changes ? changes.token : TOKEN,
    entry: {
      id: REQUEST,
      level: "brand_verified",
      networkCode: null,
      status: changes.status ?? "pending",
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
      codeExpiresAt: minutes(6 * 24 * 60),
      creator: null,
      brand: {
        tradeName: "Maison Test",
        websiteDomain: "maison-test.example",
        internalDetails: {
          legalName: "Maison Test SRL",
          registrationCountryCode: "BE",
          registrationNumber: "0123.456.789",
        },
        registrySources: changes.sources ?? SOURCES,
      },
      evidence: [],
      history: [],
      badges: [],
      alerts: [],
      opening: {
        openedBy: "member",
        reasonCode: null,
        comment: null,
        loginAddressEligible: false,
      },
    },
    reasons: [],
  });
}

const REASONS: VerificationReasonRow[] = [
  {
    code: "registration_not_found",
    position: 1,
    requiresMemberMessage: false,
    escalatesToAdmin: false,
    purgesEvidence: false,
    message: "Cette immatriculation est introuvable dans le registre public.",
    nextStep: "Vous pouvez corriger les informations et redemander le badge.",
  },
  {
    code: "other",
    position: 2,
    requiresMemberMessage: true,
    escalatesToAdmin: false,
    purgesEvidence: false,
    message: "Votre demande n’a pas pu aboutir.",
    nextStep: null,
  },
];

const TYPED: Draft = {
  ...EMPTY_DRAFT,
  domain: " Maison-Test.example ",
  channel: "dns_txt",
  code: " INFLUX-K7M2QX9A ",
  registrySourceId: EUROPE,
};

type Failed = Exclude<RelayResult<unknown>, { kind: "ok" }>;
const failed = (code: string, issues: string[] = []): Failed =>
  ({ kind: "failed", code, issues }) as Failed;

describe("L2E-23: the screen of a brand is its own (06 RG61)", () => {
  it("tells a brand from a creator by the level, speaks to the brand, and titles with its trading name, never a network", () => {
    const view = brandViewOf();
    expect(isBrand(view)).toBe(true);
    expect(whoOf(view)).toBe("brand");
    expect(titleOf(view)).toBe(t.titleBrand("Maison Test"));
    expect(modeOf(view)).toBe("deciding");
    expect(modeOf(brandViewOf({ outcome: "read_only", token: null }))).toBe(
      "readOnly",
    );
  });

  it("offers a brand the two internal reasons that fit it, and a creator the whole closed list", () => {
    expect(reexamineReasonsOf(brandViewOf())).toEqual([
      "registry_unavailable",
      "network_unreachable",
    ]);
    for (const code of reexamineReasonsOf(brandViewOf())) {
      expect(VERIFICATION_REEXAMINE_REASON_CODES).toContain(code);
      expect(b.decision.reexamineReasons[code]).toBeTruthy();
    }
  });

  it("never proposes to send a capture, and says there is no degraded badge (06 RG51, RG52, CA28, CA29)", () => {
    const written = [
      b.procedure.never,
      b.procedure.steps.join(" "),
      b.source.noneAction,
    ].join(" ");
    expect(written).toMatch(/jamais de capture/);
    expect(written).toMatch(/aucun badge dégradé|pas de badge dégradé/);
    expect(written).not.toMatch(/envoyez|envoyer une capture/i);
  });
});

describe("L2E-23: what the agent types is checked in the order of the screen, and the register is chosen, never typed (06 RG52, D79 (12))", () => {
  it("asks the domain, then the way the code is published, then the code, then the register, each in its own words", () => {
    expect(brandGrantCheck(EMPTY_DRAFT, TOKEN, SOURCES)).toEqual({
      ok: false,
      problem: { field: "domain", text: b.problems.domain },
    });
    expect(
      brandGrantCheck(
        { ...EMPTY_DRAFT, domain: "https://x.example/" },
        TOKEN,
        SOURCES,
      ),
    ).toEqual({
      ok: false,
      problem: { field: "domain", text: b.problems.domainShape },
    });
    expect(
      brandGrantCheck(
        { ...EMPTY_DRAFT, domain: "maison.example" },
        TOKEN,
        SOURCES,
      ),
    ).toEqual({
      ok: false,
      problem: { field: "channel", text: b.problems.channel },
    });
    const published = {
      ...EMPTY_DRAFT,
      domain: "maison.example",
      channel: "web_page" as const,
    };
    expect(brandGrantCheck(published, TOKEN, SOURCES)).toEqual({
      ok: false,
      problem: { field: "code", text: b.problems.code },
    });
    expect(
      brandGrantCheck(
        { ...published, code: "INFLUX-0O1IL2AB" },
        TOKEN,
        SOURCES,
      ),
    ).toEqual({
      ok: false,
      problem: { field: "code", text: t.problems.codeShape },
    });
    expect(
      brandGrantCheck(
        { ...published, code: "INFLUX-K7M2QX9A" },
        TOKEN,
        SOURCES,
      ),
    ).toEqual({
      ok: false,
      problem: { field: "registry", text: b.problems.registry },
    });
  });

  it("accepts only a source the dossier served, and refuses to grant when the country has none (RG52, D79 (12))", () => {
    expect(
      brandGrantCheck(
        { ...TYPED, registrySourceId: "cccccccc-2222-4333-8444-555555555553" },
        TOKEN,
        SOURCES,
      ),
    ).toEqual({
      ok: false,
      problem: { field: "registry", text: b.problems.registry },
    });
    expect(brandGrantCheck(TYPED, TOKEN, [])).toEqual({
      ok: false,
      problem: { field: "registry", text: b.problems.noSource },
    });
  });

  it("sends the domain in lower case, the code as typed and trimmed, the source's id and the comment, with the token and nothing else", () => {
    expect(
      brandGrantCheck(
        { ...TYPED, internalComment: "  registre ouvert à 10 h  " },
        TOKEN,
        SOURCES,
      ),
    ).toEqual({
      ok: true,
      body: {
        reviewToken: TOKEN,
        observedCode: "INFLUX-K7M2QX9A",
        observedDomain: "maison-test.example",
        observedChannel: "dns_txt",
        registrySourceId: EUROPE,
        internalComment: "registre ouvert à 10 h",
      },
    });
    expect(brandGrantCheck(TYPED, TOKEN, SOURCES)).toMatchObject({
      ok: true,
      body: { registrySourceId: EUROPE },
    });
  });

  it("words a source in one line, and links its page only when it is a plain https address", () => {
    expect(registrySourceWords(SOURCES[1]!)).toBe(
      "GLEIF, LEI search — base mondiale des identifiants LEI (GLEIF), page contrôlée le 07/11/2026",
    );
    // L2F-21: the register of a State carries its code after the name
    expect(
      registrySourceWords({
        ...SOURCES[0]!,
        name: "California Secretary of State",
        subdivisionCode: "US-CA",
      }),
    ).toBe(
      "California Secretary of State (État US-CA) — portail européen e-Justice, page contrôlée le 07/11/2026",
    );
    expect(registryLinkOf("https://search.gleif.org/")).toBe(
      "https://search.gleif.org/",
    );
    for (const url of [
      "http://search.gleif.org/",
      "javascript:alert(1)",
      "https://user:pw@search.gleif.org/",
      "https://search.gleif.org\\evil.example/",
    ]) {
      expect(registryLinkOf(url)).toBeNull();
    }
  });
});

describe("L2E-23: the refusal speaks to the brand, and a refused call is told in the brand's words (08 RG56 to RG59; 06 RG66)", () => {
  it("sends the agent's own text for `other` only, 20 to 500 characters, in the words of the brand", () => {
    expect(
      rejectCheck(
        { ...EMPTY_DRAFT, reasonCode: "registration_not_found" },
        REASONS,
        TOKEN,
        "brand",
      ),
    ).toEqual({
      ok: true,
      body: { reviewToken: TOKEN, reasonCode: "registration_not_found" },
    });
    expect(
      rejectCheck(
        { ...EMPTY_DRAFT, reasonCode: "other", memberMessage: "trop court" },
        REASONS,
        TOKEN,
        "brand",
      ),
    ).toEqual({
      ok: false,
      problem: { field: "memberMessage", text: b.decision.messageTooShort },
    });
    expect(
      rejectCheck(
        { ...EMPTY_DRAFT, reasonCode: "other", memberMessage: "x".repeat(501) },
        REASONS,
        TOKEN,
        "brand",
      ),
    ).toEqual({
      ok: false,
      problem: { field: "memberMessage", text: b.decision.messageTooLong },
    });
    // the creator's wording is kept for a creator
    expect(
      rejectCheck(
        { ...EMPTY_DRAFT, reasonCode: "other", memberMessage: "court" },
        REASONS,
        TOKEN,
      ),
    ).toEqual({
      ok: false,
      problem: { field: "memberMessage", text: t.decision.messageTooShort },
    });
  });

  it("says a code that is not the request's, a domain that is not the brand's, a register that is gone, in the brand's words", () => {
    expect(
      refusalOf(failed("validation_failed", ["code_mismatch"]), "brand"),
    ).toEqual({
      kind: "text",
      text: b.problems.codeMismatch,
      field: "code",
    });
    expect(refusalOf(failed("validation_failed", ["code_mismatch"]))).toEqual({
      kind: "text",
      text: t.problems.codeMismatch,
      field: "code",
    });
    expect(
      refusalOf(
        failed("validation_failed", ["invalid_observed_domain"]),
        "brand",
      ),
    ).toEqual({
      kind: "text",
      text: b.problems.domainRefused,
      field: "domain",
    });
    expect(
      refusalOf(
        failed("validation_failed", ["invalid_observed_channel"]),
        "brand",
      ),
    ).toEqual({ kind: "text", text: b.problems.channel, field: "channel" });
    expect(
      refusalOf(failed("conflict", ["no_registry_source"]), "brand"),
    ).toEqual({
      kind: "text",
      text: b.problems.noSourceRefused,
      field: null,
    });
    expect(
      refusalOf(failed("conflict", ["website_domain_required"]), "brand"),
    ).toEqual({ kind: "text", text: b.problems.domainRequired, field: null });
    expect(
      refusalOf(failed("conflict", ["internal_details_required"]), "brand"),
    ).toEqual({ kind: "text", text: b.problems.detailsRequired, field: null });
    // a stale version still reads the request again, whatever the view
    expect(refusalOf(failed("conflict", ["stale_token"]), "brand")).toEqual({
      kind: "reopen",
      why: "stale",
    });
  });

  it("confirms in a sentence that names the brand, never a network: granted, refused, closed, marked", () => {
    const view = brandViewOf();
    expect(grantedNotice(view, "granted", false)).toEqual([
      b.decision.grantedNotice("Maison Test"),
    ]);
    expect(grantedNotice(view, "granted", true)).toEqual([
      b.decision.grantedNotice("Maison Test"),
      t.decision.lateMark,
    ]);
    expect(
      rejectedNotice(
        view,
        "registration_unverifiable_country",
        "rejected",
        false,
        false,
      ),
    ).toEqual([
      b.decision.refusedNotice(
        "Maison Test",
        "immatriculation non vérifiable dans ce pays",
      ),
    ]);
    expect(
      rejectedNotice(view, "account_unavailable", "closed", false, true),
    ).toEqual([
      b.decision.closedNotice(
        "Maison Test",
        "compte suspendu ou en cours de suppression",
      ),
      t.decision.lateMark,
    ]);
    expect(reexaminedNotice(view)).toEqual([
      b.decision.reexaminedNotice("Maison Test"),
    ]);
    for (const line of [
      ...grantedNotice(view, "granted", false),
      ...reexaminedNotice(view),
    ]) {
      expect(line).not.toContain("—");
    }
  });

  it("writes how a closed request of a brand ended, with the reason of the brand's list", () => {
    const view = brandViewOf({
      status: "rejected",
      token: null,
      outcome: "closed",
    });
    const closed: VerificationOpenResponse = {
      ...view,
      entry: {
        ...view.entry,
        decision: {
          decidedAt: AS_OF,
          decidedBy: { accountId: ME, displayName: "Lou" },
          late: false,
          status: "rejected",
          reasonCode: "registration_unverifiable_country",
          memberMessage: null,
          internalComment: null,
        },
      },
    };
    expect(modeOf(closed)).toBe("closed");
    const lines = closedLines(closed);
    expect(lines[0]).toBe(t.closed.rejected);
    expect(lines).toContain(
      t.closed.reason("Immatriculation non vérifiable dans ce pays"),
    );
  });
});
