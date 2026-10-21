import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "src",
);

describe("zod, imported through src/zod.ts only (03 §6.5, 18 T10.6)", () => {
  it("leaves no schema module importing zod itself", () => {
    const direct = readdirSync(SRC).filter(
      (file) =>
        file !== "zod.ts" &&
        /from "zod(?:\/[^"]*)?"/.test(
          readFileSync(path.join(SRC, file), "utf8"),
        ),
    );
    expect(direct).toEqual([]);
  });

  it("keeps the compiled parsers outside a browser", async () => {
    const { z } = await import("../src/zod.ts");
    expect(z.config().jitless).toBeUndefined();
  });
});
