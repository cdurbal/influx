import { defineConfig } from "vitest/config";

// Two projects (docs/mvp/18 §3, "Où tournent les tests en base"):
// - unit: no database, parallel;
// - db: the local Supabase stack, files run one after the other (some take table locks), and
//   NEVER skipped: an unreachable stack fails the global setup with a message that says what to
//   do. `pnpm test` runs both; `pnpm test:unit` alone never counts as green (18 §3 point 3).
export default defineConfig({
  test: {
    environment: "node",
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["tests/**/*.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "db",
          include: ["db-tests/**/*.test.ts"],
          globalSetup: ["db-tests/global-setup.ts"],
          fileParallelism: false,
          testTimeout: 60_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
});
