// Build artifact checks (T11), run by `test:artifacts` after `next build` (docs/mvp/21 §4, J1-H).
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.artifacts.ts"],
  },
});
