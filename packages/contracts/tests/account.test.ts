import { describe, expect, it } from "vitest";
import {
  AccountRoleSchema,
  AccountSchema,
  CurrencySchema,
  LanguageSchema,
  MonetaryAmountSchema,
  TermsAcceptanceSchema,
} from "../src";

describe("Contracts - Account & Common Schemas", () => {
  it("validates account roles correctly", () => {
    expect(AccountRoleSchema.safeParse("advertiser").success).toBe(true);
    expect(AccountRoleSchema.safeParse("creator").success).toBe(true);
    expect(AccountRoleSchema.safeParse("agent").success).toBe(true);
    expect(AccountRoleSchema.safeParse("admin").success).toBe(true);
    expect(AccountRoleSchema.safeParse("superman").success).toBe(false);
  });

  it("validates supported languages and currencies", () => {
    expect(LanguageSchema.safeParse("fr").success).toBe(true);
    expect(LanguageSchema.safeParse("en").success).toBe(true);
    expect(LanguageSchema.safeParse("de").success).toBe(false);

    expect(CurrencySchema.safeParse("EUR").success).toBe(true);
    expect(CurrencySchema.safeParse("USD").success).toBe(true);
    expect(CurrencySchema.safeParse("JPY").success).toBe(false);
  });

  it("validates monetary amount schema in minor units (cents)", () => {
    const validAmount = { amountMinor: 200000, currency: "EUR" };
    const parsed = MonetaryAmountSchema.safeParse(validAmount);
    expect(parsed.success).toBe(true);

    const negativeAmount = { amountMinor: -50, currency: "EUR" };
    expect(MonetaryAmountSchema.safeParse(negativeAmount).success).toBe(false);

    const floatAmount = { amountMinor: 199.99, currency: "EUR" };
    expect(MonetaryAmountSchema.safeParse(floatAmount).success).toBe(false);
  });

  it("validates complete account object and handles defaults", () => {
    const now = new Date().toISOString();
    const accountData = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      email: "contact@maisonsolene.fr",
      role: "advertiser",
      createdAt: now,
      updatedAt: now,
    };

    const parsed = AccountSchema.safeParse(accountData);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.preferredLanguage).toBe("fr");
      expect(parsed.data.countryCode).toBe("FR");
      expect(parsed.data.status).toBe("active");
    }
  });

  it("validates terms acceptance with non-circumvention acknowledgement", () => {
    const now = new Date().toISOString();
    const acceptance = {
      id: "550e8400-e29b-41d4-a716-446655440001",
      accountId: "550e8400-e29b-41d4-a716-446655440000",
      termsVersion: "2026-09-18",
      acceptedAt: now,
      hasNonCircumventionAcknowledged: true,
    };

    const parsed = TermsAcceptanceSchema.safeParse(acceptance);
    expect(parsed.success).toBe(true);
  });
});
