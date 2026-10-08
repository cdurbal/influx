// The published texts never change (docs/mvp/21 EC-62; 05 RG24, RG29): every file listed in
// apps/api/legal/published.json exists and keeps the SHA-256 recorded at its publication. A text
// accepted by a member is the proof that founds INFLUX's remuneration: changing one byte of it, or
// deleting it, would void the proof. A new text is a new label, appended to the manifest.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { sha256Hex } from "../src/domains/identity/terms.ts";
import {
  decodeLegalText,
  legalContentPath,
  LEGAL_CONTENT_ROOT,
  LEGAL_MANIFEST_FILE,
  LOCAL_SEED_DRAFTS,
  readManifest,
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
});
