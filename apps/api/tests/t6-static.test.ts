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
import { readdirSync, readFileSync } from "node:fs";
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

  it("calls each operation from its own files only (03 P7 rule (2); C3.2, J7 commit 7 review)", () => {
    // A new caller of a motif is a change of this table, seen in review: a motif never spreads
    // silently to another module (identity.member_email_change: email-change.ts alone).
    const expected: Readonly<Record<string, readonly string[]>> = {
      "identity.backoffice_enroll_totp": [
        "apps/api/src/domains/identity/backoffice-sign-in.ts",
      ],
      "identity.backoffice_reauthenticate": [
        "apps/api/src/domains/identity/backoffice-sign-in.ts",
      ],
      "identity.backoffice_sign_in": [
        "apps/api/src/domains/identity/backoffice-sign-in.ts",
        "apps/api/src/domains/identity/critical-alert.ts",
      ],
      "identity.complete_signup": [
        "apps/api/src/domains/identity/complete-signup.ts",
      ],
      "identity.member_email_change": [
        "apps/api/src/domains/identity/email-change.ts",
      ],
      "identity.member_reauthenticate": [
        "apps/api/src/domains/identity/reauthentication.ts",
      ],
      "identity.read_published_terms": [
        "apps/api/src/domains/identity/terms.ts",
      ],
      "identity.request_code": ["apps/api/src/domains/identity/login-code.ts"],
      "identity.verify_code": ["apps/api/src/domains/identity/verify-code.ts"],
      "leads.drain_outbox": [
        "apps/api/src/domains/leads/inbound/processing.ts",
        "apps/api/src/domains/leads/queue.ts",
      ],
      "leads.receive_brevo_event": [
        "apps/api/src/domains/leads/brevo-webhook.ts",
      ],
      // J9 commit 8: the beat, the probe and the technical alerts of the worker (15 RG165)
      "maintenance.run_periodic": [
        "apps/api/src/domains/maintenance/periodic.ts",
        "apps/api/src/domains/ops/worker-monitor.ts",
      ],
      // J9 commit 8: the api watches the worker (AL50), on the ops pool, no business read
      "ops.record_telemetry": [
        "apps/api/src/domains/ops/recorder.ts",
        "apps/api/src/domains/ops/worker-watch.ts",
      ],
      "privacy.execute_request": ["apps/api/src/domains/privacy/execution.ts"],
      "support.report_delivery_issue": [
        "apps/api/src/domains/identity/code-delivery-report.ts",
      ],
    };
    const found = new Map<string, Set<string>>();
    for (const call of scanElevatedCalls(applicationFiles(), DECLARATION)
      .calls) {
      const file = path.relative(ROOT, call.file).split(path.sep).join("/");
      found.set(
        call.operation,
        (found.get(call.operation) ?? new Set<string>()).add(file),
      );
    }
    expect(
      Object.fromEntries(
        [...found.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([operation, files]) => [operation, [...files].sort()]),
      ),
    ).toEqual(expected);
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
      "identity.member_email_change": "auth",
      "leads.drain_outbox": "worker",
      "maintenance.run_periodic": "worker",
      // J8 commit 8: E-5 on its own pool (PRIVACY_DATABASE_URL), never influx_worker_login
      "privacy.execute_request": "privacy",
      "ops.record_telemetry": "ops",
    };
    for (const operation of SIGNED_ELEVATED_OPERATIONS) {
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
      "identity.member_email_change",
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

describe("identity.grant_role enforces 2V and R in the database (0130)", () => {
  // J2 security review, accepted point (a), closed by 0130 (J8 commit 2): the function no longer
  // relies on apps/api for the dual control and the fresh re-authentication. A later migration
  // that redefines it without the two guards fails here, before any caller can reach it.
  it("calls both guards in its last definition of supabase/migrations", () => {
    const folder = path.join(ROOT, "supabase/migrations");
    const definitions = readdirSync(folder)
      .filter((name) => name.endsWith(".sql"))
      .sort()
      .flatMap((name) => {
        const text = readFileSync(path.join(folder, name), "utf8");
        const start = [
          ...text.matchAll(
            /create\s+(?:or\s+replace\s+)?function\s+identity\.grant_role\(/gi,
          ),
        ].at(-1)?.index;
        if (start === undefined) {
          return [];
        }
        const open = text.indexOf("$$", start);
        const close = text.indexOf("$$", open + 2);
        return [{ name, body: text.slice(open + 2, close) }];
      });
    const last = definitions.at(-1);
    expect(last?.name).toBeDefined();
    expect(last?.body).toContain("backoffice.consume_dual_control(");
    expect(last?.body).toContain("identity.assert_fresh_second_factor(");
    expect(last?.body).toContain("identity.require_active_admin()");
  });
});

/** The body of the LAST definition of a function across supabase/migrations, in file order. */
function lastDefinitionOf(
  qualifiedName: string,
): { name: string; body: string } | undefined {
  const folder = path.join(ROOT, "supabase/migrations");
  const pattern = new RegExp(
    `create\\s+(?:or\\s+replace\\s+)?function\\s+${qualifiedName.replace(".", "\\.")}\\(`,
    "gi",
  );
  return readdirSync(folder)
    .filter((name) => name.endsWith(".sql"))
    .sort()
    .flatMap((name) => {
      const text = readFileSync(path.join(folder, name), "utf8");
      const start = [...text.matchAll(pattern)].at(-1)?.index;
      if (start === undefined) {
        return [];
      }
      const open = text.indexOf("$$", start);
      const close = text.indexOf("$$", open + 2);
      return [{ name, body: text.slice(open + 2, close) }];
    })
    .at(-1);
}

describe("the admin actions of J8 commits 3, 6 and 8 keep their guards in the database (0131, 0132, 0134, 0136)", () => {
  // A later migration that redefines one of them without its guards fails here (constat cyber of
  // commit 2 on correct_email(); 03 §3.1 J · 2V · R for the role change and the admin invitation).
  it.each([
    [
      "identity.change_member_role",
      [
        "identity.require_active_admin()",
        "identity.assert_fresh_second_factor(",
        "backoffice.consume_dual_control(",
      ],
    ],
    [
      "identity.approve_admin_invitation",
      [
        "identity.require_active_admin()",
        "identity.assert_fresh_second_factor(",
        "backoffice.consume_dual_control(",
      ],
    ],
    [
      "identity.correct_email",
      [
        "identity.require_active_admin()",
        "identity.assert_fresh_second_factor(",
      ],
    ],
    [
      "identity.create_internal_invitation",
      [
        "identity.require_active_admin()",
        "identity.assert_fresh_second_factor(",
      ],
    ],
    // 0134 (J8 commit 6): the Apollo keys (05 RG81, 2V + R) and the suppression lift (RG93, R)
    [
      "backoffice.change_apollo_setting",
      [
        "identity.require_active_admin()",
        "identity.assert_fresh_second_factor(",
        "backoffice.consume_dual_control(",
      ],
    ],
    [
      "backoffice.lift_brevo_suppression",
      [
        "identity.require_active_admin()",
        "identity.assert_fresh_second_factor(",
      ],
    ],
    // 0136 (J8 commit 8): the execution of a "mes données" request is approved by an admin under
    // 2V + R (15 RG75 step 6, RG76); the worker only runs what was approved
    [
      "backoffice.approve_data_request_execution",
      [
        "identity.require_active_admin()",
        "identity.assert_fresh_second_factor(",
        "backoffice.consume_dual_control(",
      ],
    ],
  ] as const)("%s calls its guards in its last definition", (name, guards) => {
    const last = lastDefinitionOf(name);
    expect(last?.name).toBeDefined();
    for (const guard of guards) {
      expect(last?.body).toContain(guard);
    }
  });
});
