// The two locks of the component state board (RUA-05; docs/mvp/jalons/rua/modele-archi.md §6, RUA-T8):
// the `board.tsx` page extension is in the Next.js configuration in development with the flag on,
// and nowhere else, and the page of the board carries the mark that the build test looks for.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { STATE_BOARD_MARKER } from "@influx/test-kit/artifacts";
import { describe, expect, it } from "vitest";
import {
  stateBoardConfig,
  stateBoardPageExtensions,
} from "@/config/state-board";

const OPEN = { INFLUX_ENV: "development", INFLUX_STATE_BOARD: "on" } as const;

describe("RUA-T8: the page extension of the state board", () => {
  it("opens the board in development with the flag on, and adds one extension to the defaults", () => {
    expect(stateBoardPageExtensions(OPEN)).toEqual([
      "tsx",
      "ts",
      "jsx",
      "js",
      "board.tsx",
    ]);
    expect(stateBoardConfig(OPEN)).toEqual({
      pageExtensions: ["tsx", "ts", "jsx", "js", "board.tsx"],
    });
  });

  it.each([
    ["staging", "on"],
    ["production", "on"],
    ["development", undefined],
    ["development", "off"],
    ["development", "ON"],
    ["development", "true"],
    ["development", ""],
    [undefined, "on"],
    [undefined, undefined],
    ["", "on"],
  ])(
    "leaves the configuration without the key for INFLUX_ENV=%s and INFLUX_STATE_BOARD=%s",
    (environment, flag) => {
      const env = { INFLUX_ENV: environment, INFLUX_STATE_BOARD: flag };
      expect(stateBoardPageExtensions(env)).toBeUndefined();
      expect(stateBoardConfig(env)).toEqual({});
      expect("pageExtensions" in stateBoardConfig(env)).toBe(false);
    },
  );

  it("marks the page of the board with the attribute the build test looks for", () => {
    const page = readFileSync(
      path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        "..",
        "src/app/[locale]/(member)/state-board/page.board.tsx",
      ),
      "utf8",
    );
    expect(page).toContain(`${STATE_BOARD_MARKER}=`);
  });
});
