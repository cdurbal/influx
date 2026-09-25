// T11 on the build output of apps/web (docs/mvp/03-matrice-des-droits-et-rls.md §8,
// docs/mvp/21-plan-de-developpement.md §4, J1-H). Run by `test:artifacts`, after `next build`.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { scanBuildArtifacts } from "@influx/test-kit/artifacts";
import { describe, expect, it } from "vitest";

const NEXT_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  ".next",
);

describe("T11: no secret in the build artifacts", () => {
  it("ships no server variable name to the browser and no credential anywhere", () => {
    expect(scanBuildArtifacts(NEXT_DIR)).toEqual([]);
  });
});
