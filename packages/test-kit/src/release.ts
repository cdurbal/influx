// Release candidate helpers (D71 amended 2026-11-25, docs/mvp/runbooks/production.md §6):
// a production release is frozen on `main` as an immutable annotated SemVer tag `vMAJOR.MINOR.PATCH`
// and promoted to `production` through a pull request `release/vMAJOR.MINOR.PATCH → production`
// merged with a merge commit (`--no-ff`).
export type SemVer = {
  tag: `v${number}.${number}.${number}`;
  major: number;
  minor: number;
  patch: number;
};

/** Strict `vMAJOR.MINOR.PATCH` without leading zeroes (SemVer 2.0.0 core, prefixed with `v`). */
export const RELEASE_TAG_PATTERN =
  /^v(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/;

export function parseReleaseTag(input: string): SemVer {
  const match = RELEASE_TAG_PATTERN.exec(input.trim());
  if (match === null) {
    throw new Error(
      `"${input}" is not a SemVer release tag vMAJOR.MINOR.PATCH (for example v0.4.0)`,
    );
  }
  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = Number(match[3]);
  if (major === 0 && minor === 0 && patch === 0) {
    throw new Error("v0.0.0 is reserved: start at v0.1.0 or higher");
  }
  return {
    tag: `v${major}.${minor}.${patch}`,
    major,
    minor,
    patch,
  };
}

/** Negative when `a < b`, 0 when equal, positive when `a > b`. */
export function compareSemVer(a: SemVer, b: SemVer): number {
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  return a.patch - b.patch;
}

/**
 * Sorts valid `vMAJOR.MINOR.PATCH` tags in ascending SemVer order and returns the highest one
 * (or null when no release tag exists yet). Non-matching tags are ignored.
 */
export function latestReleaseTag(tags: readonly string[]): SemVer | null {
  const parsed: SemVer[] = [];
  for (const raw of tags) {
    if (RELEASE_TAG_PATTERN.test(raw.trim())) {
      parsed.push(parseReleaseTag(raw));
    }
  }
  parsed.sort(compareSemVer);
  return parsed.at(-1) ?? null;
}

/**
 * Validates that `candidate` is a strict SemVer tag strictly greater than every existing release
 * tag in `existingTags`, and returns the parsed candidate together with the previous tag (if any).
 */
export function assertNextReleaseTag(
  candidate: string,
  existingTags: readonly string[],
): { next: SemVer; previous: SemVer | null } {
  const next = parseReleaseTag(candidate);
  const previous = latestReleaseTag(existingTags);
  if (previous !== null && compareSemVer(next, previous) <= 0) {
    throw new Error(
      `release tag ${next.tag} must be strictly greater than the latest release tag ${previous.tag}`,
    );
  }
  return { next, previous };
}

/** The promotion branch of a release tag (`release/vX.Y.Z`), opened as a PR into `production`. */
export function releaseBranchOf(version: SemVer): string {
  return `release/${version.tag}`;
}

export type ReleaseNotesInput = {
  version: SemVer;
  commitSha: string;
  baseLabel: string;
  migrations: readonly string[];
  attestations: readonly string[];
  commits: readonly string[];
};

/** Markdown release notes stored on the annotated tag, the promotion PR and the GitHub Release. */
export function buildReleaseNotes(input: ReleaseNotesInput): string {
  const migrationsBlock =
    input.migrations.length === 0
      ? "- None"
      : input.migrations.map((file) => `- \`${file}\``).join("\n");
  const attestationsBlock =
    input.attestations.length === 0
      ? "- None in range"
      : input.attestations.map((line) => `- ${line}`).join("\n");
  const commitsBlock =
    input.commits.length === 0
      ? "- None"
      : input.commits.map((line) => `- ${line}`).join("\n");
  return [
    `# Release ${input.version.tag}`,
    "",
    `- **Frozen commit (\`main\`):** \`${input.commitSha}\``,
    `- **Base:** \`${input.baseLabel}\``,
    `- **Promotion branch:** \`${releaseBranchOf(input.version)} → production\``,
    "",
    `## Database migrations (${input.migrations.length})`,
    "",
    migrationsBlock,
    "",
    `## Security review attestations (${input.attestations.length})`,
    "",
    attestationsBlock,
    "",
    `## Commits (${input.commits.length})`,
    "",
    commitsBlock,
  ].join("\n");
}
