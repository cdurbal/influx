// The published texts never change (docs/mvp/21 EC-62; 05 RG24, RG29): every file listed in
// apps/api/legal/published.json exists and keeps the SHA-256 recorded at its publication. A text
// accepted by a member is the proof that founds INFLUX's remuneration: changing one byte of it, or
// deleting it, would void the proof. A new text is a new label, appended to the manifest.
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { sha256Hex } from "../src/domains/identity/terms.ts";
import {
  assertReadyForProduction,
  decodeLegalText,
  legalContentPath,
  LEGAL_CONTENT_ROOT,
  LEGAL_MANIFEST_FILE,
  LOCAL_SEED_DRAFTS,
  readManifest,
  type PublicationRequest,
  type PublishedFile,
} from "../scripts/terms-publication.ts";

const URI_PATTERN =
  /^legal\/(?:terms_of_service|privacy_policy|cookie_policy)\/(?:fr|en)\/[0-9A-Za-z._-]{1,40}\.md$/;

const manifest = readManifest();

/** Every text of the legal folder, as a content_uri. */
function legalTexts(): string[] {
  return readdirSync(path.join(LEGAL_CONTENT_ROOT, "legal"), {
    recursive: true,
  })
    .map((entry) => String(entry).split(path.sep).join("/"))
    .filter((entry) => entry.endsWith(".md"))
    .map((entry) => `legal/${entry}`)
    .sort();
}

describe("legal/published.json (21 EC-62)", () => {
  it("lists well-formed paths only, with a SHA-256 each", () => {
    expect(Object.keys(manifest).length).toBeGreaterThan(0);
    for (const uri of Object.keys(manifest)) {
      expect(uri).toMatch(URI_PATTERN);
    }
  });

  it("finds every listed file, with the bytes recorded at its publication, in strict UTF-8", () => {
    for (const [uri, sha256] of Object.entries(manifest)) {
      const file = legalContentPath(LEGAL_CONTENT_ROOT, uri);
      expect(file, uri).not.toBeNull();
      const bytes = readFileSync(file ?? "");
      expect(sha256Hex(bytes), uri).toBe(sha256);
      expect(() => decodeLegalText(bytes, uri), uri).not.toThrow();
    }
  });

  it("names one version per document and language to publish: the last entry of each", () => {
    expect(LOCAL_SEED_DRAFTS).toHaveLength(6);
    const uris = Object.keys(manifest);
    for (const draft of LOCAL_SEED_DRAFTS) {
      const prefix = `legal/${draft.document}/${draft.locale}/`;
      const ofPair = uris.filter((uri) => uri.startsWith(prefix));
      expect(ofPair.at(-1)).toBe(`${prefix}${draft.label}.md`);
    }
  });

  it("is written as JSON of two spaces with a final line break (entries are appended)", () => {
    const text = readFileSync(LEGAL_MANIFEST_FILE, "utf8");
    expect(text).toBe(`${JSON.stringify(manifest, null, 2)}\n`);
  });
});

describe("the texts of the legal folder", () => {
  it("keeps no text outside the expected paths", () => {
    for (const uri of legalTexts()) {
      expect(uri).toMatch(URI_PATTERN);
    }
  });

  it("opens every draft with its notice, in LF, without HTML, link, rate or percentage", () => {
    for (const uri of legalTexts()) {
      const text = readFileSync(path.join(LEGAL_CONTENT_ROOT, uri), "utf8");
      if (path.basename(uri).startsWith("draft-")) {
        expect(
          text.startsWith(
            "**Projet non contractuel / Draft, not contractual**",
          ),
          uri,
        ).toBe(true);
      }
      expect(text, uri).not.toContain("\r");
      expect(text, uri).not.toMatch(/<|\]\(|https?:|%/);
    }
  });

  it("refuses draft labels, draft notices, unreplaced [COMPANY NAME] placeholders and unrecorded files on production (EC-62)", () => {
    const request: PublicationRequest = {
      document: "terms_of_service",
      locale: "fr",
      label: "1.0",
    };
    const clean: PublishedFile = {
      uri: "legal/terms_of_service/fr/1.0.md",
      file: "/tmp/1.0.md",
      sha256: "a".repeat(64),
      content:
        "# Conditions générales d'utilisation d'INFLUX\n\nTexte définitif.\n",
    };
    expect(() =>
      assertReadyForProduction({ ...request, label: "draft-3" }, clean, {
        [clean.uri]: clean.sha256,
      }),
    ).toThrow(/draft-\* version labels are refused in production/);
    expect(() =>
      assertReadyForProduction(
        request,
        {
          ...clean,
          content:
            "**Projet non contractuel / Draft, not contractual**\n" +
            clean.content,
        },
        { [clean.uri]: clean.sha256 },
      ),
    ).toThrow(/still carries the draft notice/);
    expect(() =>
      assertReadyForProduction(
        request,
        {
          ...clean,
          content: "Exploité par [COMPANY NAME] Ltd.\n",
        },
        { [clean.uri]: clean.sha256 },
      ),
    ).toThrow(/unreplaced \[COMPANY NAME\] marker/);
    expect(() => assertReadyForProduction(request, clean, {})).toThrow(
      /must be recorded in legal\/published\.json/,
    );
    expect(() =>
      assertReadyForProduction(request, clean, { [clean.uri]: clean.sha256 }),
    ).not.toThrow();
  });

  it("db:publish-terms --target=production refuses the CI and a mismatched --confirm before any connection", () => {
    const script = path.join(LEGAL_CONTENT_ROOT, "scripts/publish-terms.ts");
    const env = {
      ...process.env,
      INFLUX_PRODUCTION_MIGRATION_URL:
        "postgresql://postgres.abcdefghijklmnopqrst:secret@aws-0-eu-west-3.pooler.supabase.com:5432/postgres",
    };
    const inCi = spawnSync(
      process.execPath,
      [
        script,
        "--latest",
        "--target=production",
        "--confirm=abcdefghijklmnopqrst",
      ],
      {
        cwd: LEGAL_CONTENT_ROOT,
        env: { ...env, CI: "true" },
        encoding: "utf8",
      },
    );
    expect(inCi.status).toBe(1);
    expect(inCi.stderr).toMatch(/never the CI/);

    const badConfirm = spawnSync(
      process.execPath,
      [script, "--latest", "--target=production", "--confirm=wrong"],
      {
        cwd: LEGAL_CONTENT_ROOT,
        env: { ...env, CI: "" },
        encoding: "utf8",
      },
    );
    expect(badConfirm.status).toBe(1);
    expect(badConfirm.stderr).toMatch(/--confirm must be the project ref/);
  });
});
