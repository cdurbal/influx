// Packages that never enter the repository (docs/mvp/21 §4, J3-B): `@supabase/supabase-js`
// installs `postgrest-js`, and `postgrest-js` in apps/api is a standing temptation to write
// `supabase.from(…)`, that is to reach a table without the Postgres roles of D5. Only
// `@supabase/auth-js` (and `@supabase/storage-js` at Lot 2) are allowed.
import { readFileSync } from "node:fs";
import path from "node:path";
import { listSourceFiles } from "./source-files.ts";

export const FORBIDDEN_PACKAGES: readonly string[] = [
  "@supabase/supabase-js",
  "@supabase/postgrest-js",
];

/** A dependency section of a package.json. */
const DEPENDENCY_SECTIONS = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
] as const;

/**
 * Forbidden packages declared by one package.json (text): one finding per package and section.
 * An unreadable manifest is a finding too, never a silent pass.
 */
export function forbiddenPackagesIn(manifest: string, file: string): string[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(manifest);
  } catch {
    return [`${file}: not valid JSON`];
  }
  if (typeof parsed !== "object" || parsed === null) {
    return [`${file}: not a JSON object`];
  }
  const record = parsed as Record<string, unknown>;
  return DEPENDENCY_SECTIONS.flatMap((section) => {
    const dependencies = record[section];
    if (typeof dependencies !== "object" || dependencies === null) {
      return [];
    }
    return FORBIDDEN_PACKAGES.filter((name) => name in dependencies).map(
      (name) => `${file}: ${name} in ${section}`,
    );
  });
}

/** Forbidden packages anywhere in a lockfile (text), transitive ones included. */
export function forbiddenPackagesInLockfile(
  lockfile: string,
  file: string,
): string[] {
  return FORBIDDEN_PACKAGES.filter((name) => lockfile.includes(`${name}@`)).map(
    (name) => `${file}: ${name}`,
  );
}

/**
 * The root package.json, every package.json of apps/ and packages/ (node_modules and build
 * outputs excluded), and the lockfile.
 */
export function findForbiddenPackages(root: string): string[] {
  const manifests = [
    path.join(root, "package.json"),
    ...["apps", "packages"].flatMap((directory) =>
      listSourceFiles(path.join(root, directory), ["package.json"]).filter(
        (file) => path.basename(file) === "package.json",
      ),
    ),
  ];
  const findings = manifests.flatMap((file) =>
    forbiddenPackagesIn(
      readFileSync(file, "utf8"),
      path.relative(root, file).split(path.sep).join("/"),
    ),
  );
  const lockfile = path.join(root, "pnpm-lock.yaml");
  return [
    ...findings,
    ...forbiddenPackagesInLockfile(
      readFileSync(lockfile, "utf8"),
      "pnpm-lock.yaml",
    ),
  ];
}
