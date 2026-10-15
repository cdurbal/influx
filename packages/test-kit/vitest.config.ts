import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // J7T-1: the witnesses of check-security-review (git in a temporary repository) exceed the
    // default 5 s under the load of the full suite.
    testTimeout: 20_000,
  },
});
