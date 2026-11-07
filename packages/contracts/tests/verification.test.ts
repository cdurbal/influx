import { describe, expect, it } from "vitest";
import { queueCodeSchema } from "../src/backoffice-queues.ts";
import { z } from "../src/zod.ts";
import {
  brandVerificationResponseSchema,
  compareFiguresRequestSchema,
  creatorVerificationResponseSchema,
  grantAccountRequestSchema,
  grantAudienceRequestSchema,
  grantBrandRequestSchema,
  MEMBER_VERIFICATION_RESPONSE_SCHEMAS,
  openVerificationRequestBodySchema,
  publicBadgeSchema,
  rejectVerificationRequestSchema,
  saveBrandInternalDetailsBodySchema,
  verificationEntriesQuerySchema,
  verificationEntriesSearchSchema,
  verificationEvidenceReadResponseSchema,
  verificationOpenResponseSchema,
  verificationQueueEntryRowSchema,
  verificationRequestResponseSchema,
} from "../src/verification.ts";

const TOKEN = "a".repeat(64);
const ID = "00000000-0000-4000-8000-000000000001";
const INSTANT = "2026-11-07T10:00:00.000Z";

/** Every property name of a JSON schema, at any depth. */
function propertyNames(node: unknown): string[] {
  if (Array.isArray(node)) return node.flatMap(propertyNames);
  if (node === null || typeof node !== "object") return [];
  return Object.entries(node).flatMap(([key, value]) =>
    key === "properties" && value !== null && typeof value === "object"
      ? [...Object.keys(value), ...Object.values(value).flatMap(propertyNames)]
      : propertyNames(value),
  );
}

const FORBIDDEN_FOR_A_MEMBER =
  /key|token|checksum|handle|url|agent|holder|claim|lock|comment|gap|difference|retention|escalat|reexamin|observed|declared|legalname$/iu;

describe("the member side holds no piece key, token, handle, lock or comment (08 RG82, RG89, RG90; invariants 1, 13, 15)", () => {
  it("names no such property in any answer a member or an advertiser reads, however deep", () => {
    const names = Object.entries(MEMBER_VERIFICATION_RESPONSE_SCHEMAS).flatMap(
      ([label, schema]) =>
        propertyNames(z.toJSONSchema(schema, { io: "output" })).map(
          (name) => `${label}.${name}`,
        ),
    );
    expect(names.length).toBeGreaterThan(30);
    expect(
      names.filter((name) => {
        const [label, property = ""] = name.split(".");
        // the brand reads its own registered name back, in its own answer only
        return (
          FORBIDDEN_FOR_A_MEMBER.test(property) &&
          !(label === "brandVerification" && property === "legalName")
        );
      }),
    ).toEqual([]);
  });

  it("closes every object: an answer carrying a field outside the list is refused", () => {
    const badge = {
      level: "audience_verified",
      networkCode: "instagram",
      state: "active",
      grantedAt: INSTANT,
      periodStart: "2026-10-01",
      periodEnd: "2026-10-30",
      evidenceSource: "native_dashboard",
    };
    expect(publicBadgeSchema.safeParse(badge).success).toBe(true);
    for (const extra of [
      { handle: "maison.aube" },
      { profileUrl: "https://www.instagram.com/maison.aube" },
      { agent: "Camille" },
      { objectKey: "a/b/c.webp" },
      { gap: 30 },
      { reasonCode: "other" },
    ]) {
      expect(
        publicBadgeSchema.safeParse({ ...badge, ...extra }).success,
        JSON.stringify(extra),
      ).toBe(false);
    }
    expect(
      publicBadgeSchema.safeParse({ ...badge, state: "to_reconfirm" }).success,
    ).toBe(false);
    expect(
      publicBadgeSchema.safeParse({ ...badge, state: "revoked" }).success,
    ).toBe(false);
  });

  it("reads the creator's lines network by network, a request with its code, pieces as metadata and its refusal", () => {
    const request = {
      id: ID,
      level: "audience_verified",
      status: "rejected",
      networkCode: "instagram",
      createdAt: INSTANT,
      submittedAt: INSTANT,
      code: null,
      evidence: [
        {
          id: ID,
          state: "purging",
          createdAt: INSTANT,
          width: 1080,
          height: 1920,
          byteSize: 120000,
        },
      ],
      refusal: {
        reasonCode: "evidence_too_old",
        message: "La capture est trop ancienne.",
        decidedAt: INSTANT,
      },
    };
    const line = { networkCode: "instagram", badges: [], requests: [request] };
    expect(
      creatorVerificationResponseSchema.safeParse({
        asOf: INSTANT,
        lines: [line],
      }).success,
    ).toBe(true);
    expect(
      verificationRequestResponseSchema.safeParse({ request, created: true })
        .success,
    ).toBe(true);
    const withPiece = (extra: object) => ({
      ...request,
      evidence: [{ ...request.evidence[0], ...extra }],
    });
    for (const bad of [
      withPiece({ objectKey: "a/b/c.webp" }),
      withPiece({ checksum: "00" }),
      withPiece({ retentionDueAt: INSTANT }),
      { ...request, claimedBy: "agent" },
      { ...request, internalComment: "x" },
    ]) {
      expect(
        verificationRequestResponseSchema.safeParse({
          request: bad,
          created: false,
        }).success,
      ).toBe(false);
    }
  });

  it("gives a brand its own block back, and nothing of an agent", () => {
    const ok = {
      asOf: INSTANT,
      badge: null,
      request: null,
      internalDetails: {
        legalName: "Maison Aube SAS",
        registrationCountryCode: "FR",
        registrationNumber: "123 456 789",
      },
    };
    expect(brandVerificationResponseSchema.safeParse(ok).success).toBe(true);
    expect(
      brandVerificationResponseSchema.safeParse({ ...ok, agent: "x" }).success,
    ).toBe(false);
  });
});

describe("the bodies a member sends", () => {
  it("names a line by its network and a level the creator may ask for, never by an identifier", () => {
    for (const body of [
      { networkCode: "instagram", level: "account_verified" },
      { networkCode: "tiktok", level: "audience_verified" },
    ]) {
      expect(openVerificationRequestBodySchema.safeParse(body).success).toBe(
        true,
      );
    }
    for (const body of [
      { networkCode: "instagram", level: "brand_verified" },
      { networkCode: "instagram" },
      { socialAccountId: ID, level: "account_verified" },
      { accountId: ID, networkCode: "instagram", level: "account_verified" },
      { networkCode: "Instagram!", level: "account_verified" },
    ]) {
      expect(
        openVerificationRequestBodySchema.safeParse(body).success,
        JSON.stringify(body),
      ).toBe(false);
    }
  });

  it("holds the three fields of the internal block of a brand, none left out (06 RG51)", () => {
    const ok = {
      legalName: "Maison Aube SAS",
      registrationCountryCode: "FR",
      registrationNumber: "123 456 789",
    };
    expect(saveBrandInternalDetailsBodySchema.safeParse(ok).success).toBe(true);
    for (const bad of [
      { ...ok, legalName: "" },
      { ...ok, legalName: "x".repeat(161) },
      { ...ok, registrationNumber: "1".repeat(41) },
      { ...ok, registrationCountryCode: "ZZ" },
      { legalName: ok.legalName, registrationNumber: ok.registrationNumber },
      { ...ok, website: "https://x.test" },
    ]) {
      expect(
        saveBrandInternalDetailsBodySchema.safeParse(bad).success,
        JSON.stringify(bad),
      ).toBe(false);
    }
  });
});

describe("the bodies of the agent's decisions (08 RG9, RG36 to RG38bis, RG56 to RG59; cas limite 2)", () => {
  const figures = {
    followers: 47300,
    postsLast30Days: 12,
    avgComments: 40,
    engagementBp: 350,
  };
  const audience = {
    reviewToken: TOKEN,
    ...figures,
    periodStart: "2026-10-01",
    periodEnd: "2026-10-30",
    observedHandle: "maison.aube",
  };

  it("takes the three figures, a period and the handle, the engagement null when it was not readable, zero accepted", () => {
    expect(grantAudienceRequestSchema.safeParse(audience).success).toBe(true);
    expect(
      grantAudienceRequestSchema.safeParse({
        ...audience,
        followers: 0,
        postsLast30Days: 0,
        avgComments: 0,
        engagementBp: null,
      }).success,
    ).toBe(true);
    expect(
      compareFiguresRequestSchema.safeParse({ reviewToken: TOKEN, ...figures })
        .success,
    ).toBe(true);
  });

  it("refuses a negative figure, an engagement of 350 %, a missing period or figure, and a tranche typed by hand (RG20)", () => {
    for (const bad of [
      { ...audience, followers: -1 },
      { ...audience, postsLast30Days: 1.5 },
      { ...audience, engagementBp: 35000 },
      { ...audience, periodStart: undefined },
      { ...audience, periodEnd: "30/10/2026" },
      { ...audience, avgComments: undefined },
      { ...audience, band: "micro" },
      { ...audience, reviewToken: "short" },
      { ...audience, observedHandle: "" },
      { ...audience, internalComment: "" },
    ]) {
      expect(
        grantAudienceRequestSchema.safeParse(bad).success,
        JSON.stringify(bad),
      ).toBe(false);
    }
  });

  it("takes an ownership code of the issued shape and the handle read online (RG25, CA13, CA14)", () => {
    const ok = {
      reviewToken: TOKEN,
      observedCode: "INFLUX-23456789",
      observedHandle: "maison.aube",
    };
    expect(grantAccountRequestSchema.safeParse(ok).success).toBe(true);
    for (const bad of [
      { ...ok, observedCode: "INFLUX-0123456I" },
      { ...ok, observedCode: "https://x.test" },
      { ...ok, observedHandle: undefined },
      { ...ok, profileUrl: "https://www.instagram.com/x" },
    ]) {
      expect(grantAccountRequestSchema.safeParse(bad).success).toBe(false);
    }
  });

  it("takes for a brand the code, the domain, the channel and the register consulted (06 RG49 to RG52)", () => {
    const ok = {
      reviewToken: TOKEN,
      observedCode: "INFLUX-23456789",
      observedDomain: "maison-aube.fr",
      observedChannel: "dns_txt",
      registrySourceId: ID,
    };
    expect(grantBrandRequestSchema.safeParse(ok).success).toBe(true);
    expect(
      grantBrandRequestSchema.safeParse({ ...ok, observedChannel: "email" })
        .success,
    ).toBe(false);
    expect(
      grantBrandRequestSchema.safeParse({ ...ok, observedDomain: "Maison.fr" })
        .success,
    ).toBe(false);
  });

  it("never refuses without a reason of the closed lists, and bounds the message to the member (RG56, RG57)", () => {
    const base = { reviewToken: TOKEN, reasonCode: "evidence_too_old" };
    expect(rejectVerificationRequestSchema.safeParse(base).success).toBe(true);
    expect(
      rejectVerificationRequestSchema.safeParse({
        ...base,
        reasonCode: "name_mismatch",
      }).success,
    ).toBe(true);
    for (const bad of [
      { reviewToken: TOKEN },
      { ...base, reasonCode: "not_a_reason" },
      { ...base, reasonCode: "other", memberMessage: "x".repeat(19) },
      { ...base, reasonCode: "other", memberMessage: "x".repeat(501) },
    ]) {
      expect(
        rejectVerificationRequestSchema.safeParse(bad).success,
        JSON.stringify(bad),
      ).toBe(false);
    }
    expect(
      rejectVerificationRequestSchema.safeParse({
        ...base,
        reasonCode: "other",
        memberMessage: "x".repeat(20),
        internalComment: "Capture floue.",
      }).success,
    ).toBe(true);
  });
});

describe("T16 no amount, rate or price in the contract (CLAUDE.md §2, D48, D78, 08 RG8)", () => {
  it("names no such property in any schema of the file", () => {
    const everyName = propertyNames(
      z.toJSONSchema(
        z.union([
          grantAudienceRequestSchema,
          grantAccountRequestSchema,
          grantBrandRequestSchema,
          rejectVerificationRequestSchema,
          brandVerificationResponseSchema,
          creatorVerificationResponseSchema,
        ]),
        { io: "input" },
      ),
    );
    expect(everyName.length).toBeGreaterThan(30);
    expect(
      everyName.filter((name) =>
        /price|tariff|amount|currency|commission|^rate|^net(?:Creator|Amount|Payout)|fee/iu.test(
          name,
        ),
      ),
    ).toEqual([]);
  });
});

describe("queue 4, the list and the decision view (08 RG47, RG55, RG62, RG63, RG84; modele -19; commit 14)", () => {
  it("declares no declared figure, no code and no key in a line of the list or in the decision view, however deep", () => {
    const names = [
      ...propertyNames(
        z.toJSONSchema(verificationQueueEntryRowSchema, { io: "output" }),
      ),
      ...propertyNames(
        z.toJSONSchema(verificationOpenResponseSchema, { io: "output" }),
      ),
    ];
    expect(names.length).toBeGreaterThan(40);
    expect(
      names.filter((name) =>
        /declared|followers|postsLast30Days|avgComments|engagementBp|objectKey|object_key|checksum|^observed|ownershipCode|signed/iu.test(
          name,
        ),
      ),
    ).toEqual([]);
    // what an agent reads of a piece is its sides and its size, and the bytes by the journalled route only
    expect(
      Object.keys(verificationEvidenceReadResponseSchema.shape).sort(),
    ).toEqual(["byteSize", "contentType", "data", "height", "width"]);
  });

  it("orders the oldest first by default, names its sorts, refuses a period backwards, a key outside the list and an unbounded page (RG34, RG62)", () => {
    expect(verificationEntriesQuerySchema.parse({})).toMatchObject({
      sort: "age",
      limit: 20,
    });
    expect(
      verificationEntriesSearchSchema.parse({ sort: "sla", limit: 50 }),
    ).toMatchObject({ sort: "sla", limit: 50 });
    for (const refused of [
      { sort: "name" },
      { limit: "51" },
      { from: "2026-11-02T00:00:00Z", to: "2026-11-01T00:00:00Z" },
      { handle: "someone" },
      { overdue: "false" },
    ]) {
      expect(
        verificationEntriesQuerySchema.safeParse(refused).success,
        JSON.stringify(refused),
      ).toBe(false);
    }
  });

  it("counts the two views of the queue under their own codes, beside queue 1 (modele §6)", () => {
    expect(queueCodeSchema.options).toEqual([
      "profiles_advertiser",
      "verification_creators",
      "verification_brands",
    ]);
  });
});
