// T7 in integration and T13 on the build of apps/backoffice (docs/mvp/18 T7, T13; 21 §J9 commit 7): the
// built front, started with `next start`, in front of an API double; every request over HTTP.
// Run by `test:artifacts`, after `next build`. The suite is shared by both fronts
// (@influx/test-kit/relay-integration), whose four relay files are identical (T7.8).
import path from "node:path";
import { fileURLToPath } from "node:url";
import { relayIntegrationSuite } from "@influx/test-kit/relay-integration";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

relayIntegrationSuite({
  frontRoot: path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
  unknownPage: {
    path: "/cette-page-n-existe-pas",
    text: "Cette page n’existe pas",
  },
  vitest: { describe, it, expect, beforeAll, afterAll, beforeEach },
});
