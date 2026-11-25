// Blocks 2 and 3 of the record of a brand in words (docs/mvp/15 RG41, RG123; 17b §3.5; L2C-18): pure
// functions of src/components/account-brand-view.ts, without a browser. The server says what the
// contact person and the profile hold, and what was decided; these only word them.
import {
  accountBrandSchema,
  type AccountBrand,
} from "@influx/contracts/backoffice-accounts";
import { describe, expect, it } from "vitest";
import {
  brandContactLines,
  brandProfileLines,
  decisionLines,
} from "../src/components/account-brand-view";
import { formatDateTime } from "../src/components/view-model";
import { messages } from "../src/messages/fr";

const t = messages.accountBrand;

const BRAND: AccountBrand = {
  contact: {
    firstName: "Camille",
    role: "head_of_marketing",
    email: "camille@brand.example.test",
    phone: null,
    url: null,
  },
  profile: {
    status: "published",
    completenessPercent: 82,
    changedFields: ["advertiser.presentation", "advertiser.logo"],
    decisions: [
      {
        outcome: "published",
        decidedAt: "2026-11-02T10:00:00.000Z",
        decidedBy: {
          accountId: "6f1d6c1e-0000-4000-8000-000000000001",
          displayName: "Lou",
        },
        late: true,
        reasonCode: null,
      },
      {
        outcome: "rejected",
        decidedAt: "2026-11-01T09:30:00.000Z",
        decidedBy: null,
        late: false,
        reasonCode: "logo_non_compliant",
      },
    ],
    hasMoreDecisions: false,
  },
};

describe("brandContactLines (block 2)", () => {
  it("puts the first name, then the role in words, then the coordinates, an empty one said", () => {
    const lines = brandContactLines(BRAND.contact);
    expect(lines.map((line) => line.key)).toEqual([
      "firstName",
      "role",
      "email",
      "phone",
      "url",
    ]);
    expect(lines.find((line) => line.key === "role")?.value).toBe(
      "Head of marketing",
    );
    expect(lines.find((line) => line.key === "email")?.value).toBe(
      "camille@brand.example.test",
    );
    expect(lines.find((line) => line.key === "phone")?.value).toBe(
      messages.queueReview.unset,
    );
  });

  it("says a role that is not set, never a blank", () => {
    const lines = brandContactLines({ ...BRAND.contact, role: null });
    expect(lines.find((line) => line.key === "role")?.value).toBe(
      messages.queueReview.unset,
    );
  });
});

describe("brandProfileLines (block 3)", () => {
  it("words the state, the completeness and the fields waiting for a decision", () => {
    const lines = brandProfileLines(BRAND.profile);
    expect(lines.map((line) => line.value)).toEqual([
      messages.queueReview.statuses.published,
      "82 %",
      `${messages.queueList.fields["advertiser.presentation"]}, ${messages.queueList.fields["advertiser.logo"]}`,
    ]);
  });

  it("says none when nothing waits, and an unknown completeness as not set", () => {
    const lines = brandProfileLines({
      ...BRAND.profile,
      status: "pending_review",
      completenessPercent: null,
      changedFields: [],
    });
    expect(lines.map((line) => line.value)).toEqual([
      messages.queueReview.statuses.pending_review,
      messages.queueReview.unset,
      t.changedNone,
    ]);
  });
});

describe("decisionLines", () => {
  it("writes each decision in a sentence, a late one marked, a refusal with its reason", () => {
    const lines = decisionLines(BRAND.profile.decisions).map(
      (line) => line.line,
    );
    expect(lines).toEqual([
      `${t.decision.published(formatDateTime("2026-11-02T10:00:00.000Z"), "Lou")}${t.decision.late}`,
      t.decision.rejected(
        formatDateTime("2026-11-01T09:30:00.000Z"),
        t.decision.unknownAgent,
        messages.queueReview.decision.reasonLabels.logo_non_compliant,
      ),
    ]);
  });

  it("gives each line its own key, even for two decisions at the same instant", () => {
    const same = [
      BRAND.profile.decisions[0],
      BRAND.profile.decisions[0],
    ].flatMap((decision) => (decision === undefined ? [] : [decision]));
    const keys = decisionLines(same).map((line) => line.key);
    expect(new Set(keys).size).toBe(2);
  });
});

describe("the contract of the brand blocks", () => {
  it("refuses a field outside the list: no message, no internal comment, no legal name", () => {
    expect(accountBrandSchema.safeParse(BRAND).success).toBe(true);
    expect(
      accountBrandSchema.safeParse({
        ...BRAND,
        profile: {
          ...BRAND.profile,
          decisions: [
            { ...BRAND.profile.decisions[0], internalComment: "private" },
          ],
        },
      }).success,
    ).toBe(false);
    expect(
      accountBrandSchema.safeParse({ ...BRAND, legalName: "Maison" }).success,
    ).toBe(false);
  });
});
