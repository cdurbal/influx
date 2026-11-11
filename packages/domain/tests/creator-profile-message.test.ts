import { describe, expect, it } from "vitest";
import {
  CREATOR_PROFILE_REQUIRED_FIELDS,
  submissionMessageForInput,
  submissionMessageOf,
} from "../src/creator-profile/index.ts";

describe("L2G-U1 the message of RG90 names what is missing, nothing else (RG90, RG91)", () => {
  it("names every missing field, in the order of the form, with their number", () => {
    expect(
      submissionMessageOf(["bio", "portfolio", "accountVerified"]),
    ).toEqual({
      kind: "missing",
      fields: ["bio", "portfolio", "accountVerified"],
      count: 3,
      rules: { bio: "RG4", portfolio: "RG77", accountVerified: "RG16" },
    });
  });

  it("is ready when nothing is missing, and rests on RG4", () => {
    expect(submissionMessageOf([])).toEqual({ kind: "ready", rule: "RG4" });
  });

  it("ties every statement to a written rule: no field without one (RG91)", () => {
    const message = submissionMessageOf([...CREATOR_PROFILE_REQUIRED_FIELDS]);
    if (message.kind !== "missing") throw new Error("expected a list");
    expect(Object.keys(message.rules).sort()).toEqual(
      [...CREATOR_PROFILE_REQUIRED_FIELDS].sort(),
    );
    expect(new Set(Object.values(message.rules))).toEqual(
      new Set(["RG4", "RG16", "RG77"]),
    );
  });

  it("reads the list of the profile as it stands: an empty one misses them all", () => {
    expect(submissionMessageForInput({})).toMatchObject({
      kind: "missing",
      count: CREATOR_PROFILE_REQUIRED_FIELDS.length,
    });
  });
});
