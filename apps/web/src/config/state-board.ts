// The component state board is a page of the workstations and of the e2e run, never of a deployed
// build (RUA-05; docs/mvp/jalons/rua/modele-archi.md §6). It is a page that Next.js does not know:
// its file is `page.board.tsx`, and the `board.tsx` page extension is added to the configuration only
// when BOTH locks are turned: INFLUX_ENV is "development" (staging and production run as
// "staging" and "production" on Railway) and INFLUX_STATE_BOARD is "on". Otherwise the key is
// absent from the configuration, the page is no route, and none of its modules is ever imported by
// the build (proved on the artifact: tests/build.artifacts.ts, RUA-T8).
// Pure, with the environment given: this module is the one that reads it, next.config.ts passes it
// `process.env` (02 §12.3), nothing else of src/ does.

/** The extensions Next.js serves pages from by default. */
const DEFAULT_PAGE_EXTENSIONS: readonly string[] = ["tsx", "ts", "jsx", "js"];

/** The extension of the board's page and of its sections: `page.board.tsx`, `button.board.tsx`. */
export const STATE_BOARD_PAGE_EXTENSION = "board.tsx";

/** The environment the board reads `INFLUX_ENV` and `INFLUX_STATE_BOARD` from: `process.env`, or a test double. */
export type StateBoardEnvironment = Readonly<
  Record<string, string | undefined>
>;

/** The page extensions with the board's, or `undefined` when a lock is not turned. */
export function stateBoardPageExtensions(
  environment: StateBoardEnvironment,
): string[] | undefined {
  const open =
    environment.INFLUX_ENV === "development" &&
    environment.INFLUX_STATE_BOARD === "on";
  return open
    ? [...DEFAULT_PAGE_EXTENSIONS, STATE_BOARD_PAGE_EXTENSION]
    : undefined;
}

/**
 * The part of the Next.js configuration that opens the board: `{ pageExtensions }`, or an object
 * without that key (the default of Next.js then holds).
 */
export function stateBoardConfig(environment: StateBoardEnvironment): {
  pageExtensions?: string[];
} {
  const pageExtensions = stateBoardPageExtensions(environment);
  return pageExtensions === undefined ? {} : { pageExtensions };
}
