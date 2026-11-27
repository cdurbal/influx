// The two locks of the component state board (RUA-05; docs/mvp/jalons/rua/modele-archi.md §6, RUA-T8):
// the `board.tsx` page extension is in the Next.js configuration in development with the flag on,
// and nowhere else, and the page of the board carries the mark that the build test looks for.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { STATE_BOARD_MARKER } from "@influx/test-kit/artifacts";
import { describe, expect, it } from "vitest";
import {
  stateBoardConfig,
  stateBoardPageExtensions,
} from "@/config/state-board";
import { BOARD_FAMILIES } from "@/app/[locale]/(member)/state-board/board-section.board";

const BOARD = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "src/app/[locale]/(member)/state-board",
);

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

  // RUB-fix-10a: the mark is on the frame of every page, the index and each family (layout.board.tsx).
  it("marks the frame of every page of the board with the attribute the build test looks for", () => {
    expect(
      readFileSync(path.join(BOARD, "layout.board.tsx"), "utf8"),
    ).toContain(`${STATE_BOARD_MARKER}=`);
  });

  // RUB-fix-10a (rub/modele-archi.md §4): a folder per family the index lists, each with its page, and no other.
  it("gives each family of the index a folder with its page, and no folder to another", () => {
    const folders = readdirSync(BOARD, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    expect(folders).toEqual(Object.keys(BOARD_FAMILIES).sort());
    for (const family of folders) {
      expect(
        existsSync(path.join(BOARD, family, "page.board.tsx")),
        family,
      ).toBe(true);
    }
  });
});
