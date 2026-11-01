// T11 on the third deployed artifact (docs/mvp/18 T11.1, T11.2; 21 §J9 commit 7). apps/web and
// apps/backoffice are checked on their `.next` by `test:artifacts`; apps/api has no build: Railway
// runs its sources with Node (deploy/railway/api.json, worker.json). What it runs therefore holds
// no secret value, whatever the variable: no JWT, no connection string with a password, no
// Supabase secret key, no Brevo key. The tests are out of scope (their fake values are deliberate).
import path from "node:path";
import { fileURLToPath } from "node:url";
import { scanApiRuntimeFiles } from "@influx/test-kit/artifacts";
import { describe, expect, it } from "vitest";

const REPOSITORY_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

describe("T11: the files apps/api runs hold no secret value", () => {
  it("finds none in its code, legal texts, scripts, contracts and deployment files", () => {
    expect(scanApiRuntimeFiles(REPOSITORY_ROOT)).toEqual([]);
  });
});
