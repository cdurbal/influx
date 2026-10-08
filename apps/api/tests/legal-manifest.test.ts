// The published texts never change (docs/mvp/21 EC-62; 05 RG24, RG29): every file listed in
// apps/api/legal/published.json exists and keeps the SHA-256 recorded at its publication. A text
// accepted by a member is the proof that founds INFLUX's remuneration: changing one byte of it, or
// deleting it, would make the API fail closed and void the proof. A new text is a new label.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  legalContentPath,
  LEGAL_CONTENT_ROOT,
  sha256Hex,
} from "../src/domains/identity/terms.ts";
import {
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

  it("finds every listed file, with the bytes recorded at its publication", () => {
    for (const [uri, sha256] of Object.entries(manifest)) {
      const file = legalContentPath(LEGAL_CONTENT_ROOT, uri);
      expect(file, uri).not.toBeNull();
      expect(sha256Hex(readFileSync(file ?? "")), uri).toBe(sha256);
    }
  });

  it("lists the six drafts the local seed publishes", () => {
    for (const draft of LOCAL_SEED_DRAFTS) {
      expect(Object.keys(manifest)).toContain(
        `legal/${draft.document}/${draft.locale}/${draft.label}.md`,
      );
    }
  });

  it("is written with sorted keys and a final line break (stable diffs)", () => {
    const text = readFileSync(LEGAL_MANIFEST_FILE, "utf8");
    const sorted = Object.fromEntries(
      Object.entries(manifest).sort(([a], [b]) => (a < b ? -1 : 1)),
    );
    expect(text).toBe(`${JSON.stringify(sorted, null, 2)}\n`);
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
