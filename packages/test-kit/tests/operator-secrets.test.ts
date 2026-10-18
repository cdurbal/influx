// D70 commit 3: the one-time secrets of the staging operator scripts go to a file ignored by Git.
import { describe, expect, it } from "vitest";
import {
  isIgnoredByGit,
  OPERATOR_SECRETS_DIRECTORY,
  operatorSecretsFileName,
} from "../src/operator-secrets.ts";

describe("operator secrets file", () => {
  it("is named after the script and the UTC time, without a colon", () => {
    expect(
      operatorSecretsFileName(
        "staging-demo-accounts",
        new Date("2026-10-18T09:05:07.123Z"),
      ),
    ).toBe("staging-demo-accounts-2026-10-18T09-05-07-123Z.txt");
  });

  it("refuses a name that is not kebab-case (no path)", () => {
    expect(() => operatorSecretsFileName("../x", new Date())).toThrow(
      /kebab-case/,
    );
    expect(() => operatorSecretsFileName("", new Date())).toThrow(/kebab-case/);
  });

  it("lives in a directory Git ignores, and the check tells an ignored path from a tracked one", () => {
    expect(isIgnoredByGit(`${OPERATOR_SECRETS_DIRECTORY}/any-file.txt`)).toBe(
      true,
    );
    expect(isIgnoredByGit("packages/test-kit/src/operator-secrets.ts")).toBe(
      false,
    );
  });
});
