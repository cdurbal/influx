import { describe, expect, it } from "vitest";
import {
  UNIDENTIFIED_USER_AGENT,
  USER_AGENT_FAMILIES,
  USER_AGENT_SUMMARIES,
  USER_AGENT_SUMMARY_KEY_PATTERN,
  USER_AGENT_SYSTEMS,
  userAgentSummarySchema,
} from "../src/user-agent.ts";

describe("browser summaries (05 Q14, 21 RG-J3-5)", () => {
  it("is every family on every system, plus the unidentified summary, each once", () => {
    expect(USER_AGENT_SUMMARIES).toHaveLength(
      USER_AGENT_FAMILIES.length * USER_AGENT_SYSTEMS.length + 1,
    );
    expect(new Set(USER_AGENT_SUMMARIES).size).toBe(
      USER_AGENT_SUMMARIES.length,
    );
    expect(USER_AGENT_SUMMARIES).toContain(UNIDENTIFIED_USER_AGENT);
    expect(USER_AGENT_SUMMARIES).toContain("firefox.windows");
  });

  it("has the key format enforced by the database", () => {
    for (const summary of USER_AGENT_SUMMARIES) {
      expect(summary).toMatch(USER_AGENT_SUMMARY_KEY_PATTERN);
    }
  });

  it("never holds a digit: no version, no device model (RG-J3-5)", () => {
    for (const summary of USER_AGENT_SUMMARIES) {
      expect(summary).not.toMatch(/\d/);
    }
  });

  it("refuses anything outside the list, a raw agent string first", () => {
    for (const value of [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      "chrome.windows.10",
      "Chrome.Windows",
      "chrome",
      "",
    ]) {
      expect(userAgentSummarySchema.safeParse(value).success, value).toBe(
        false,
      );
    }
    expect(userAgentSummarySchema.parse("safari.ios")).toBe("safari.ios");
  });
});
