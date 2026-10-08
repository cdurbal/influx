// The publication helpers of the public documents (docs/mvp/21 EC-62 and its amendment): the
// strict decoding of a text (its SHA-256 in the database must be the file's, 0109), the version to
// publish per document and language (the last entry of the manifest), and the manifest written by
// appending. No database here: the transaction is db-tests/tm10-terms-publication.test.ts.
import { createHash } from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  decodeLegalText,
  latestPublications,
  publishedFileOf,
  readManifest,
  recordInManifest,
} from "../scripts/terms-publication.ts";

let root: string;

beforeAll(() => {
  root = mkdtempSync(path.join(tmpdir(), "influx-publication-"));
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

function writeLegal(uri: string, bytes: Uint8Array): void {
  const file = path.join(root, ...uri.split("/"));
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, bytes);
}

describe("decodeLegalText: strict UTF-8 only", () => {
  it("accepts UTF-8 text, accents and non-Latin characters included", () => {
    const text = "# Conditions générales\n\n« Projet » — 契約\n";
    expect(decodeLegalText(Buffer.from(text, "utf8"), "x.md")).toBe(text);
  });

  it("refuses a byte order mark, even before valid UTF-8", () => {
    const bytes = Buffer.concat([
      Buffer.from([0xef, 0xbb, 0xbf]),
      Buffer.from("# Terms\n", "utf8"),
    ]);
    expect(() => decodeLegalText(bytes, "x.md")).toThrow(/byte order mark/);
  });

  it.each([
    ["Latin-1", Buffer.from("Conditions g\xe9n\xe9rales\n", "latin1")],
    ["a lone continuation byte", Buffer.from([0x41, 0x80, 0x0a])],
    ["a truncated sequence", Buffer.from([0x41, 0xe2, 0x82])],
    ["an overlong encoding", Buffer.from([0xc0, 0xaf])],
    ["an encoded surrogate", Buffer.from([0xed, 0xa0, 0x80])],
  ])("refuses %s", (_name, bytes) => {
    expect(() => decodeLegalText(bytes, "x.md")).toThrow(
      /not valid UTF-8|re-encode/,
    );
  });

  it("refuses UTF-16, read as UTF-8 with NUL characters", () => {
    expect(() =>
      decodeLegalText(Buffer.from("# Terms\n", "utf16le"), "x.md"),
    ).toThrow(/NUL/);
  });

  it("refuses an empty text", () => {
    expect(() => decodeLegalText(new Uint8Array(), "x.md")).toThrow(
      /characters/,
    );
  });

  it("reads the file of a request, with the SHA-256 of its exact bytes", () => {
    const text = "**Projet non contractuel / Draft, not contractual**\n";
    writeLegal("legal/cookie_policy/fr/draft-7.md", Buffer.from(text, "utf8"));
    const published = publishedFileOf(
      { document: "cookie_policy", locale: "fr", label: "draft-7" },
      root,
    );
    expect(published).toMatchObject({
      uri: "legal/cookie_policy/fr/draft-7.md",
      content: text,
      sha256: createHash("sha256").update(text, "utf8").digest("hex"),
    });
    writeLegal("legal/cookie_policy/fr/draft-8.md", Buffer.from([0xff]));
    expect(() =>
      publishedFileOf(
        { document: "cookie_policy", locale: "fr", label: "draft-8" },
        root,
      ),
    ).toThrow(/not valid UTF-8/);
  });
});

describe("the manifest", () => {
  const SHA = (digit: string) => digit.repeat(64);

  it("names the LAST entry of each document and language, in the order of the file", () => {
    expect(
      latestPublications({
        "legal/terms_of_service/fr/draft-1.md": SHA("1"),
        "legal/terms_of_service/en/draft-1.md": SHA("2"),
        "legal/terms_of_service/fr/final-2027.md": SHA("3"),
        "legal/terms_of_service/fr/draft-10.md": SHA("4"),
        "legal/cookie_policy/en/draft-2.md": SHA("5"),
      }),
    ).toEqual([
      { document: "terms_of_service", locale: "en", label: "draft-1" },
      { document: "terms_of_service", locale: "fr", label: "draft-10" },
      { document: "cookie_policy", locale: "en", label: "draft-2" },
    ]);
  });

  it("refuses a malformed path", () => {
    expect(() =>
      latestPublications({ "legal/supervision_notice/fr/a.md": SHA("1") }),
    ).toThrow(/malformed path/);
  });

  it("appends a new entry, keeps the others in place, and never changes a recorded one", () => {
    const file = path.join(root, "published.json");
    writeFileSync(
      file,
      `${JSON.stringify({ "legal/terms_of_service/fr/draft-2.md": SHA("b") }, null, 2)}\n`,
    );
    const published = {
      uri: "legal/terms_of_service/fr/draft-1.md",
      file: "",
      sha256: SHA("a"),
      content: "",
    };
    recordInManifest(published, file);
    expect(Object.keys(readManifest(file))).toEqual([
      "legal/terms_of_service/fr/draft-2.md",
      "legal/terms_of_service/fr/draft-1.md",
    ]);
    expect(readFileSync(file, "utf8").endsWith("}\n")).toBe(true);
    expect(() =>
      recordInManifest({ ...published, sha256: SHA("c") }, file),
    ).toThrow(/never changes/);
  });
});
