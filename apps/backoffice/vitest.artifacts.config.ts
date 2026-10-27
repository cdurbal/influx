// Build artifact checks (T11), run by `test:artifacts` after `next build` (docs/mvp/21 §4, J1-H).
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.artifacts.ts"],
    // J9T-4: a cold scan of the build output takes about 16 s; the default 5 s made T11 flaky.
    testTimeout: 60_000,
  },
});
