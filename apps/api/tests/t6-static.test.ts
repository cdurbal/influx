// 18 T6 — the closed list of elevated operations is really closed (static part: T6.1, T6.3,
// T6.6). T6.2 is in tests/db-unit.test.ts; T6.4 and T6.5 start at J3 with the first elevation.
// Every analyser is first proven on the witness files of test-witnesses/.
import {
  ELEVATED_OPERATIONS,
  SIGNED_ELEVATED_OPERATIONS,
} from "@influx/contracts/elevated-operations";
import {
  filesTakingARole,
  listSourceFiles,
  namesIn,
  reachableModules,
  scanElevatedCalls,
  scanSessionState,
  SCRIPT_EXTENSIONS,
} from "@influx/test-kit/static";
import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { elevatedPoolKindOf } from "../src/db/index.ts";

const API_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const ROOT = path.resolve(API_ROOT, "../..");
const PACKAGES = path.join(ROOT, "packages");
const DECLARATION = path.join(API_ROOT, "src/db/index.ts");

function witnesses(directory: string): string[] {
  const folder = path.join(ROOT, "test-witnesses", directory);
  return readdirSync(folder).map((name) => path.join(folder, name));
}

/** Application code of apps/ and packages/, test files excluded (18 T6, set A). */
function applicationFiles(): string[] {
  return ["apps", "packages"]
    .flatMap((directory) =>
      listSourceFiles(path.join(ROOT, directory), SCRIPT_EXTENSIONS),
    )
    .filter(
      (file) =>
        !/[\\/](tests|db-tests)[\\/]/.test(file) && !/\.test\.tsx?$/.test(file),
    );
}

describe("T6.1: A = U and U ⊆ P", () => {
  it("proves the analyser on the witness files", () => {
    for (const file of witnesses("t6")) {
      const report = scanElevatedCalls([file], DECLARATION);
      const undeclared = report.operations.filter(
        (operation) =>
          !(ELEVATED_OPERATIONS as readonly string[]).includes(operation),
      );
      expect(
        report.findings.length + undeclared.length,
        path.basename(file),
      ).toBeGreaterThan(0);
    }
  });

  it("finds exactly the declared operations, as literals, in direct calls", () => {
    const report = scanElevatedCalls(applicationFiles(), DECLARATION);
    expect(report.findings).toEqual([]);
    expect([...new Set(report.operations)].sort()).toEqual(
      [...ELEVATED_OPERATIONS].sort(),
    );
    for (const operation of ELEVATED_OPERATIONS) {
      expect(SIGNED_ELEVATED_OPERATIONS).toContain(operation);
    }
  });

  it("binds each declared operation to the pool of 03 P7 (rule 5)", () => {
    const expected: Readonly<Record<string, string>> = {
      "identity.request_code": "auth",
      "support.report_delivery_issue": "auth",
      "identity.read_published_terms": "auth",
      // J7 decision 2: leads family, received by the api (ELEVATED_POOL_EXCEPTIONS)
      "leads.receive_brevo_event": "auth",
      "identity.verify_code": "auth",
      "identity.complete_signup": "auth",
      "identity.backoffice_sign_in": "auth",
      "identity.backoffice_enroll_totp": "auth",
      "identity.backoffice_reauthenticate": "auth",
      "identity.member_reauthenticate": "auth",
      "leads.drain_outbox": "worker",
      "maintenance.run_periodic": "worker",
      "ops.record_telemetry": "ops",
    };
    for (const operation of SIGNED_ELEVATED_OPERATIONS) {
      // privacy.execute_request (E-5) has no pool in apps/api before the Lot 5.
      expect(elevatedPoolKindOf(operation), operation).toBe(
        expected[operation] ?? null,
      );
    }
    for (const operation of ELEVATED_OPERATIONS) {
      expect(expected[operation], operation).toBeDefined();
    }
  });
});

describe("T6.3: separation by process, on the import graph", () => {
  // Named exceptions: the configuration module names every database variable in order to refuse
  // one set on the wrong service (EC-20), and the contract module declares the signed list P.
  const EXEMPT = new Set([
    path.join(API_ROOT, "src/config/schema.ts"),
    path.join(PACKAGES, "contracts/src/elevated-operations.ts"),
  ]);

  function namesReachableFrom(entry: string): Map<string, string[]> {
    return new Map(
      reachableModules(path.join(API_ROOT, entry), PACKAGES)
        .filter((file) => !EXEMPT.has(file))
        .map((file) => [file, namesIn(file)]),
    );
  }

  function offenders(
    modules: Map<string, string[]>,
    forbidden: (name: string) => boolean,
  ): string[] {
    return [...modules].flatMap(([file, names]) =>
      names
        .filter(forbidden)
        .map((name) => `${path.relative(ROOT, file)}: ${name}`),
    );
  }

  it("keeps the worker's operations and variables out of the api process", () => {
    const modules = namesReachableFrom("src/main.ts");
    expect(modules.size).toBeGreaterThan(5);
    const forbidden = new Set([
      "WORKER_DATABASE_URL",
      "PRIVACY_DATABASE_URL",
      "leads.drain_outbox",
      "maintenance.run_periodic",
      "privacy.execute_request",
    ]);
    expect(offenders(modules, (name) => forbidden.has(name))).toEqual([]);
  });

  it("keeps the api's operations and variables out of the worker process", () => {
    const modules = namesReachableFrom("src/worker.ts");
    expect(modules.size).toBeGreaterThan(3);
    const forbidden = new Set([
      "DATABASE_URL",
      "AUTH_DATABASE_URL",
      "OPS_DATABASE_URL",
      "identity.request_code",
      "identity.read_published_terms",
      "identity.verify_code",
      "identity.complete_signup",
      "identity.backoffice_sign_in",
      "identity.backoffice_enroll_totp",
      "identity.backoffice_reauthenticate",
      "identity.member_reauthenticate",
      "leads.receive_brevo_event",
      "support.report_delivery_issue",
      "ops.record_telemetry",
    ]);
    expect(offenders(modules, (name) => forbidden.has(name))).toEqual([]);
  });
});

describe("T6.6: no session state", () => {
  it("proves every rule on its witness file", () => {
    for (const file of witnesses("t6-session")) {
      expect(scanSessionState([file]), path.basename(file)).toHaveLength(1);
    }
  });

  /** apps/api/src and the src folder of each package: the scope of T6.6. */
  function scannedFiles(): string[] {
    return [
      ...listSourceFiles(path.join(API_ROOT, "src"), SCRIPT_EXTENSIONS),
      ...readdirSync(PACKAGES).flatMap((name) =>
        listSourceFiles(path.join(PACKAGES, name, "src"), SCRIPT_EXTENSIONS),
      ),
    ];
  }

  it("finds none in apps/api/src and packages/*/src", () => {
    expect(scanSessionState(scannedFiles())).toEqual([]);
  });

  it("proves the role rule on its witness file", () => {
    const files = witnesses("t6-role");
    expect(files.length).toBeGreaterThan(0);
    expect(filesTakingARole(files)).toEqual(files);
  });

  // End-of-J2 security review S1: a domain function taking `influx_admin` inside an advertiser
  // transaction would pass every other guard, since influx_app may SET any of the four roles.
  it("takes a role in exactly one place of apps/api/src and packages/*/src, plus the harness", () => {
    expect(
      filesTakingARole(scannedFiles())
        .map((file) => path.relative(ROOT, file).replace(/\\/g, "/"))
        .sort(),
    ).toEqual([
      "apps/api/src/db/roles.ts",
      // The one named exemption: the role harness of the database tests.
      "packages/test-kit/src/db/harness.ts",
    ]);
  });
});

describe("identity.grant_role has no caller in apps/api before 0107", () => {
  // J2 security review, accepted point (a): 2V and R are not enforced in the database yet.
  it("is named nowhere in apps/api/src", () => {
    const files = listSourceFiles(
      path.join(API_ROOT, "src"),
      SCRIPT_EXTENSIONS,
    );
    const callers = files.filter((file) =>
      namesIn(file).some((name) => name.includes("grant_role")),
    );
    expect(callers).toEqual([]);
  });
});
