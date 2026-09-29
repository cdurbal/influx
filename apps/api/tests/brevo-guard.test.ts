// 21 §3 EC-19 point 3: the code loaded by the HTTP process calls ONE Brevo path, the unitary
// transactional send `/smtp/email`, from src/platform/brevo-transactional.ts only. Any other Brevo
// path (contacts, lists, campaigns…) is importable from the worker's code only.
import {
  listSourceFiles,
  namesIn,
  reachableModules,
  SCRIPT_EXTENSIONS,
} from "@influx/test-kit/static";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const API_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const PACKAGES = path.resolve(API_ROOT, "../../packages");
const SENDER = path.join(API_ROOT, "src/platform/brevo-transactional.ts");
const CONFIG = path.join(API_ROOT, "src/config/schema.ts");

/** First segments of the Brevo API v3 (developers.brevo.com), `smtp` included. */
const BREVO_PATH =
  /^\/(?:smtp|contacts|emailCampaigns|smsCampaigns|whatsappCampaigns|senders|webhooks|transactionalSMS|transactionalWhatsApp|account|reseller|companies|crm|conversations|domains|ecommerce|events|feeds|categories|products|orders|coupons|inbound|payments|corporate|processes|organization|loyalty)(?:\/|$)/;

function brevoPathsIn(names: readonly string[]): string[] {
  return names.filter((name) => BREVO_PATH.test(name));
}

function relative(file: string): string {
  return path.relative(API_ROOT, file).replace(/\\/g, "/");
}

describe("EC-19 point 3: the api process sends transactional e-mails only", () => {
  it("proves the matcher", () => {
    expect(
      brevoPathsIn([
        "/smtp/email",
        "/contacts",
        "/contacts/lists",
        "/emailCampaigns/12/sendNow",
        "/smtp/templates",
        "/v1/auth/request-code",
        "/",
      ]),
    ).toEqual([
      "/smtp/email",
      "/contacts",
      "/contacts/lists",
      "/emailCampaigns/12/sendNow",
      "/smtp/templates",
    ]);
  });

  it("names /smtp/email, and no other Brevo path, in the modules reachable from main.ts", () => {
    const modules = reachableModules(
      path.join(API_ROOT, "src/main.ts"),
      PACKAGES,
    );
    expect(modules).toContain(SENDER);
    const found = modules.flatMap((file) =>
      brevoPathsIn(namesIn(file)).map((name) => `${relative(file)}: ${name}`),
    );
    expect(found).toEqual(["src/platform/brevo-transactional.ts: /smtp/email"]);
  });

  it("names the Brevo host in the sender's configuration only", () => {
    const files = listSourceFiles(
      path.join(API_ROOT, "src"),
      SCRIPT_EXTENSIONS,
    );
    const naming = files.filter((file) =>
      namesIn(file).some((name) => name.includes("brevo.com")),
    );
    expect(naming.map(relative)).toEqual([relative(CONFIG)]);
  });
});
