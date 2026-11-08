// What the screens of the verification of a brand show, decided outside the components (docs/mvp/06
// RG46 to RG54, RG84, CA26 to CA29; 17 §4.2; jalons/l2e, commit 20): the written and dated badge, the
// refusals of the brand's closed list and what to do next, the state of the one request, the steps of the
// journey read back from the API, block 4 of the profile (the domain asked BEFORE the button, CA26),
// the internal block as a form, and the translation files against RG84 mot pour mot and against the
// words a badge never carries (RG50). Pure functions and files, no browser.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  BRAND_REJECTION_REASON_CODES,
  type BrandVerificationResponse,
  type OwnBadge,
  type OwnRefusal,
  type OwnRequest,
} from "@influx/contracts/verification";
import { describe, expect, it } from "vitest";
import {
  BRAND_CTA_KEYS,
  BRAND_STEP_COUNT,
  DETAILS_FIELDS,
  DETAILS_LABEL_KEYS,
  brandBadgeKeyOf,
  brandBlockOf,
  brandJourneyOf,
  brandRefusalViewOf,
  brandStepNumberOf,
  canRestartBrandRequest,
  countryOf,
  detailsBodyOf,
  detailsDraftOf,
  emptyDetailsOf,
  isSavedDetails,
} from "@/components/verification/brand-verification-view";
import { failureOf } from "@/components/verification/verification-view";
import enBrandProfile from "@/locales/en/brand-profile.json";
import enVerification from "@/locales/en/verification.json";
import frBrandProfile from "@/locales/fr/brand-profile.json";
import frVerification from "@/locales/fr/verification.json";

const GRANTED_AT = "2026-03-03T10:15:00Z";

function badge(
  state: OwnBadge["state"],
  extra: Partial<OwnBadge> = {},
): OwnBadge {
  return {
    level: "brand_verified",
    networkCode: null,
    state,
    grantedAt: GRANTED_AT,
    periodStart: null,
    periodEnd: null,
    evidenceSource: "domain_and_registry",
    expiresAt: "2027-03-03T10:15:00Z",
    ...extra,
  };
}

function request(
  status: OwnRequest["status"],
  extra: Partial<OwnRequest> = {},
): OwnRequest {
  return {
    id: "5c1f0a3e-8a47-4c0b-9b53-0e2b9a1d7f10",
    level: "brand_verified",
    status,
    networkCode: null,
    createdAt: "2026-03-01T09:00:00Z",
    submittedAt: null,
    code: null,
    evidence: [],
    refusal: null,
    ...extra,
  };
}

function refused(reasonCode: OwnRefusal["reasonCode"], message = "") {
  return request("rejected", {
    submittedAt: "2026-03-01T09:05:00Z",
    refusal: { reasonCode, message, decidedAt: "2026-03-02T08:00:00Z" },
  });
}

function answer(
  parts: Partial<Omit<BrandVerificationResponse, "asOf">> = {},
): BrandVerificationResponse {
  return {
    asOf: "2026-03-05T08:00:00Z",
    badge: null,
    request: null,
    internalDetails: null,
    ...parts,
  };
}

const LIVE_CODE = {
  code: "INFLUX-K7M2QX9A",
  expiresAt: "2026-03-08T09:00:00Z",
} as const;

describe("the badge « Marque vérifiée », written and dated (06 RG49, RG53, RG54, RG84, RG97)", () => {
  it("writes the current badge and the one to refresh with their own sentence, the date in both", () => {
    expect(brandBadgeKeyOf(badge("active"))).toBe("badge.label");
    expect(brandBadgeKeyOf(badge("to_refresh"))).toBe("badge.toRefresh");
    // no state of a badge goes without a sentence that carries the date
    expect(brandBadgeKeyOf(badge("to_reconfirm"))).toBe("badge.toRefresh");
    for (const texts of [frBrandProfile, enBrandProfile]) {
      expect(texts.badge.label).toContain("{date}");
      expect(texts.badge.toRefresh).toContain("{date}");
    }
  });
});

describe("a refusal of the brand's list and what comes next (06 RG56 to RG59, modele §5)", () => {
  it("tells each reason of the closed list its next step, and keeps the team's words for `other` only", () => {
    const next = Object.fromEntries(
      BRAND_REJECTION_REASON_CODES.map((code) => [
        code,
        brandRefusalViewOf({
          reasonCode: code,
          message: "Un mot de l'agent",
          decidedAt: GRANTED_AT,
        }),
      ]),
    );
    expect(next.domain_code_not_found?.next).toBe("retryCode");
    expect(next.registration_not_found?.next).toBe("fixDetails");
    expect(next.name_mismatch?.next).toBe("fixDetails");
    expect(next.registration_unverifiable_country?.next).toBe("retryLater");
    expect(next.account_unavailable?.next).toBe("contact");
    expect(next.other?.next).toBe("contact");
    expect(next.other?.agentMessage).toBe("Un mot de l'agent");
    for (const [code, view] of Object.entries(next)) {
      if (code !== "other") {
        expect(view.agentMessage, code).toBeNull();
      }
    }
  });

  it("reads a code outside the brand's list (a creator's) as `other`, never as a reason it does not know", () => {
    const view = brandRefusalViewOf({
      reasonCode: "evidence_too_old",
      message: "   ",
      decidedAt: GRANTED_AT,
    });
    expect(view.reason).toBe("other");
    expect(view.agentMessage).toBeNull();
  });

  it("offers a new request unless only the team can say what is next", () => {
    for (const code of BRAND_REJECTION_REASON_CODES) {
      const view = brandRefusalViewOf({
        reasonCode: code,
        message: "",
        decidedAt: GRANTED_AT,
      });
      expect(canRestartBrandRequest(view), code).toBe(
        code !== "account_unavailable" && code !== "other",
      );
    }
  });
});

describe("the steps of the brand's journey, read back from the API (06 RG49 to RG52)", () => {
  it("opens on what the badge states when nothing is asked, with what happened to the last request", () => {
    const first = brandJourneyOf(answer());
    expect(first).toMatchObject({
      stage: "affirm",
      request: null,
      badge: null,
      refresh: false,
      previous: null,
    });
    const after = brandJourneyOf(
      answer({ request: refused("registration_not_found") }),
    );
    expect(after.stage).toBe("affirm");
    expect(after.previous?.kind).toBe("refused");
    expect(
      brandJourneyOf(answer({ request: request("expired") })).previous?.kind,
    ).toBe("expired");
    // a request withdrawn leaves nothing to say
    expect(
      brandJourneyOf(answer({ request: request("cancelled") })).previous,
    ).toBeNull();
  });

  it("takes a draft back at its code, and tells a code that ran out", () => {
    const live = brandJourneyOf(
      answer({ request: request("draft", { code: LIVE_CODE }) }),
    );
    expect(live).toMatchObject({ stage: "publish", codeExpired: false });
    expect(live.request?.code?.code).toBe(LIVE_CODE.code);
    const ran = brandJourneyOf(answer({ request: request("draft") }));
    expect(ran).toMatchObject({ stage: "publish", codeExpired: true });
  });

  it("shows the follow-up of a request sent, and the end once the badge stands", () => {
    expect(
      brandJourneyOf(
        answer({
          request: request("pending", { submittedAt: "2026-03-01T09:05:00Z" }),
        }),
      ).stage,
    ).toBe("sent");
    const done = brandJourneyOf(
      answer({ badge: badge("active"), request: request("approved") }),
    );
    expect(done).toMatchObject({ stage: "done", refresh: false });
    expect(done.badge?.state).toBe("active");
  });

  it("makes a badge to refresh a renewal, and a request in course wins over the badge", () => {
    const renewal = brandJourneyOf(answer({ badge: badge("to_refresh") }));
    expect(renewal).toMatchObject({ stage: "affirm", refresh: true });
    const asked = brandJourneyOf(
      answer({
        badge: badge("to_refresh"),
        request: request("draft", { code: LIVE_CODE }),
      }),
    );
    expect(asked.stage).toBe("publish");
  });

  it("counts three screens, the follow-up being the third", () => {
    expect(BRAND_STEP_COUNT).toBe(3);
    expect(brandStepNumberOf("affirm")).toBe(1);
    expect(brandStepNumberOf("publish")).toBe(2);
    expect(brandStepNumberOf("sent")).toBe(3);
    expect(brandStepNumberOf("done")).toBe(3);
  });
});

describe("block 4 of the profile: the one button, and the domain written before it (06 CA26)", () => {
  it("offers to ask for the badge when nothing is asked and the profile holds a domain", () => {
    expect(brandBlockOf(answer(), true)).toMatchObject({
      action: "start",
      needsDomain: false,
    });
  });

  it("says the domain is needed, with no button, for a new request without a domain (the publication stays possible)", () => {
    expect(brandBlockOf(answer(), false)).toMatchObject({
      action: null,
      needsDomain: true,
    });
    expect(
      brandBlockOf(answer({ request: refused("name_mismatch") }), false),
    ).toMatchObject({ action: null, needsDomain: true });
    expect(
      brandBlockOf(answer({ badge: badge("to_refresh") }), false),
    ).toMatchObject({ action: null, needsDomain: true });
  });

  it("takes a draft back whatever the profile holds, and offers nothing while a request waits or a badge stands", () => {
    expect(
      brandBlockOf(
        answer({ request: request("draft", { code: LIVE_CODE }) }),
        false,
      ),
    ).toMatchObject({ action: "resume", needsDomain: false });
    expect(
      brandBlockOf(answer({ request: request("pending") }), true).action,
    ).toBeNull();
    expect(
      brandBlockOf(answer({ badge: badge("active") }), true).action,
    ).toBeNull();
  });

  it("offers a new request after a refusal that allows one, an expiry or a badge to refresh, and none when the team must speak", () => {
    expect(
      brandBlockOf(answer({ request: refused("domain_code_not_found") }), true)
        .action,
    ).toBe("restart");
    expect(
      brandBlockOf(answer({ request: request("expired") }), true).action,
    ).toBe("restart");
    expect(
      brandBlockOf(answer({ badge: badge("to_refresh") }), true).action,
    ).toBe("refresh");
    expect(
      brandBlockOf(answer({ request: refused("other", "Un mot") }), true)
        .action,
    ).toBeNull();
  });

  it("has a label for every action, in both languages", () => {
    for (const key of Object.values(BRAND_CTA_KEYS)) {
      const name = key
        .split(".")
        .at(-1) as keyof typeof frVerification.brandBlock.cta;
      expect(frVerification.brandBlock.cta[name], key).toBeTruthy();
      expect(enVerification.brandBlock.cta[name], key).toBeTruthy();
    }
  });
});

describe("the internal block as a form (06 RG46, RG47)", () => {
  const FULL = {
    legalName: "  Maison E2E SAS ",
    registrationCountryCode: "FR",
    registrationNumber: " 123 456 789 ",
  } as const;

  it("starts empty, or from what the API holds, and reads three empty fields in the order of the form", () => {
    const empty = detailsDraftOf(null);
    expect(emptyDetailsOf(empty)).toEqual([...DETAILS_FIELDS]);
    expect(detailsBodyOf(empty)).toBeNull();
    const held = detailsDraftOf({
      legalName: "Maison E2E SAS",
      registrationCountryCode: "FR",
      registrationNumber: "123 456 789",
    });
    expect(emptyDetailsOf(held)).toEqual([]);
    expect(
      emptyDetailsOf({ ...held, legalName: "   ", registrationNumber: "" }),
    ).toEqual(["legalName", "registrationNumber"]);
  });

  it("sends the three fields with their edges trimmed and nothing else changed, only once all are there", () => {
    expect(detailsBodyOf(FULL)).toEqual({
      legalName: "Maison E2E SAS",
      registrationCountryCode: "FR",
      registrationNumber: "123 456 789",
    });
    expect(detailsBodyOf({ ...FULL, registrationCountryCode: "" })).toBeNull();
  });

  it("knows a form that holds what the API holds, so that nothing is saved twice", () => {
    const stored = {
      legalName: "Maison E2E SAS",
      registrationCountryCode: "FR",
      registrationNumber: "123 456 789",
    } as const;
    expect(isSavedDetails(FULL, stored)).toBe(true);
    expect(isSavedDetails(FULL, null)).toBe(false);
    expect(isSavedDetails({ ...FULL, legalName: "Autre SAS" }, stored)).toBe(
      false,
    );
    expect(isSavedDetails(detailsDraftOf(null), stored)).toBe(false);
  });

  it("reads a country of the list, and anything else as none chosen", () => {
    expect(countryOf("FR")).toBe("FR");
    expect(countryOf("fr")).toBe("");
    expect(countryOf("")).toBe("");
    expect(countryOf("ZZ")).toBe("");
  });

  it("has the texts of every field, in both languages", () => {
    for (const field of DETAILS_FIELDS) {
      const key = DETAILS_LABEL_KEYS[field];
      for (const texts of [frVerification, enVerification]) {
        expect(texts.brand.details[key].label, field).toBeTruthy();
        expect(texts.brand.details[key].help, field).toBeTruthy();
      }
    }
  });
});

describe("the failures of the brand's calls (06 CA26, RG47)", () => {
  const failed = (code: string, issues: string[] = []) => ({
    kind: "failed" as const,
    code,
    issues,
  });

  it("says a missing domain and a missing internal block as such, and a field the database refuses", () => {
    expect(failureOf(failed("conflict", ["website_domain_required"])).key).toBe(
      "websiteDomainRequired",
    );
    expect(
      failureOf(failed("conflict", ["internal_details_required"])).key,
    ).toBe("internalDetailsRequired");
    expect(failureOf(failed("validation_failed", ["unknown"])).key).toBe(
      "detailsInvalid",
    );
    for (const key of [
      "websiteDomainRequired",
      "internalDetailsRequired",
      "detailsInvalid",
    ]) {
      expect(frVerification.failure, key).toHaveProperty(key);
      expect(enVerification.failure, key).toHaveProperty(key);
    }
  });
});

// --- The translation files -----------------------------------------------------------------------

const SPEC = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
  "docs",
  "mvp",
  "06-criteres-profil-marque.md",
);

/** The rows of the table of RG84 of the specification for a key: French and English, exactly as written there. */
function rg84(key: string): { fr: string; en: string } | undefined {
  const row = readFileSync(SPEC, "utf8")
    .split("\n")
    .find((line) => line.startsWith(`| \`${key}\` |`));
  const cells = row?.split("|").map((cell) => cell.trim());
  return cells === undefined
    ? undefined
    : { fr: cells[2] ?? "", en: cells[3] ?? "" };
}

describe("the translation files of the brand verification (06 RG50, RG84; fiche invariant 12)", () => {
  it("holds the two keys of the badge of RG84 mot pour mot, in French and in English", () => {
    for (const name of ["label", "toRefresh"] as const) {
      const written = rg84(`brandProfile.badge.${name}`);
      expect(written, name).toBeDefined();
      expect(frBrandProfile.badge[name], `fr ${name}`).toBe(written?.fr);
      expect(enBrandProfile.badge[name], `en ${name}`).toBe(written?.en);
    }
  });

  it("holds the reasons of the brand's list as `l2e/modele.md` §5 writes them, one per code, in both languages", () => {
    for (const code of BRAND_REJECTION_REASON_CODES) {
      expect(frVerification.brand.refusal.reason[code], code).toBeTruthy();
      expect(enVerification.brand.refusal.reason[code], code).toBeTruthy();
    }
    expect(frVerification.brand.refusal.reason.domain_code_not_found).toBe(
      "Nous n'avons trouvé le code ni dans les enregistrements DNS de votre domaine, ni sur une page de votre site.",
    );
    expect(enVerification.brand.refusal.reason.registration_not_found).toBe(
      "This registration could not be found in your country's public register.",
    );
    expect(
      frVerification.brand.refusal.reason.registration_unverifiable_country,
    ).toContain("Immatriculation non vérifiable dans ce pays");
  });

  it("states the two things the badge says and the four it does not (RG49, RG50)", () => {
    for (const texts of [frVerification, enVerification]) {
      expect(Object.keys(texts.brand.affirm.items)).toEqual([
        "domain",
        "registration",
      ]);
      const not = { ...texts.brand.affirm.not } as Record<string, string>;
      delete not.title;
      expect(Object.keys(not)).toEqual([
        "solvency",
        "serious",
        "experience",
        "quality",
      ]);
    }
  });

  it("promises no publication and no validation: asking for the badge only counts in the completeness", () => {
    expect(frVerification.brandBlock.optional).toContain(
      "sans rien promettre sur la validation ni sur la publication",
    );
    expect(enVerification.brandBlock.optional).toContain(
      "promises nothing about the review or the publication",
    );
  });

  it("asks the internal block only on the journey, never on the profile, and says who reads it", () => {
    // the profile's block 4 names no field of the internal block: they are asked at the request (RG47)
    for (const texts of [frVerification, enVerification]) {
      for (const text of Object.values(texts.brandBlock).flatMap((value) =>
        typeof value === "string" ? [value] : [],
      )) {
        expect(text).not.toMatch(/raison sociale|legal name/i);
      }
    }
    expect(frBrandProfile.layer.internal).toBe(
      "Visible uniquement par l'équipe INFLUX.",
    );
  });

  it("uses a section title for block 4 in both languages", () => {
    expect(frBrandProfile.section.verification).toBe("4. Vérification");
    expect(enBrandProfile.section.verification).toBe("4. Verification");
  });
});
