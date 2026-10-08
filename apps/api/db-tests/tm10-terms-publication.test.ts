// TM10 (J5, amendment of 21 EC-62) — the publication script on a row published before 0109,
// WITHOUT its text (draft-2 on the workstations, demo-fictive-1 on staging): the script fills the
// text, once, instead of refusing; the hash constraint of 0109 refuses any text other than the
// one fingerprinted at publication; a second run changes nothing. The decoding of a file (strict
// UTF-8, no byte order mark) is tests/terms-publication.test.ts.
//
// Each case commits a CLOSED row under a label of its own (identity.terms_versions is never
// deleted): no version in force of the workstation is touched.
import { randomBytes } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  publishedFileOf,
  publishTermsVersion,
  type PublicationRequest,
} from "../scripts/terms-publication.ts";
import { sha256Hex } from "../src/domains/identity/terms.ts";
import { migrationRole } from "./support.ts";

const CHECK_VIOLATION = "23514";

let root: string;

beforeAll(() => {
  root = mkdtempSync(path.join(tmpdir(), "influx-tm10-publication-"));
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

/** A file of the temporary legal folder, and the request that publishes it. */
function fileFor(text: string): PublicationRequest {
  const request: PublicationRequest = {
    document: "cookie_policy",
    locale: "en",
    label: `tm10-fill-${randomBytes(4).toString("hex")}`,
  };
  const file = path.join(
    root,
    "legal",
    request.document,
    request.locale,
    `${request.label}.md`,
  );
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, text, "utf8");
  return request;
}

/** A closed row published without its text, as before 0109, fingerprinting `text`. */
async function inheritedRow(
  request: PublicationRequest,
  text: string,
): Promise<string> {
  const [row] = await migrationRole()<{ id: string }[]>`
    insert into identity.terms_versions
      (document_kind, locale, version_label, content_uri, content_hash, requires_acceptance,
       published_at, effective_from, effective_to)
    values (${request.document}::identity.document_kind, ${request.locale}, ${request.label},
            ${`legal/${request.document}/${request.locale}/${request.label}.md`},
            decode(${sha256Hex(text)}, 'hex'), false,
            now() - interval '2 days', now() - interval '2 days', now() - interval '1 day')
    returning id::text`;
  if (row === undefined) {
    throw new Error("inherited row not inserted");
  }
  return row.id;
}

async function stored(id: string) {
  const [row] = await migrationRole()<
    { content: string | null; closed: boolean; same_label_rows: number }[]
  >`
    select content, effective_to is not null as closed,
           (select count(*)::int from identity.terms_versions o
             where o.version_label = v.version_label) as same_label_rows
      from identity.terms_versions v where id = ${id}`;
  return row;
}

describe("publication of a label published without its text (EC-62 (B))", () => {
  it("fills the text once, changes nothing else, and leaves a second run without effect", async () => {
    const text = "# Cookie Policy\n\nÉtat : brouillon « draft ».\n";
    const request = fileFor(text);
    const id = await inheritedRow(request, text);
    const published = publishedFileOf(request, root);

    expect(
      await publishTermsVersion(migrationRole(), request, published),
    ).toEqual({ kind: "content_filled", id });
    expect(await stored(id)).toEqual({
      content: text,
      closed: true,
      same_label_rows: 1,
    });

    expect(
      await publishTermsVersion(migrationRole(), request, published),
    ).toEqual({ kind: "already_published" });
    expect((await stored(id))?.content).toBe(text);
  });

  it("refuses a text other than the one fingerprinted at publication (0109 constraint)", async () => {
    const request = fileFor("# Cookie Policy, edited after publication\n");
    const id = await inheritedRow(request, "# Cookie Policy\n");
    const published = publishedFileOf(request, root);
    await expect(
      publishTermsVersion(migrationRole(), request, published),
    ).rejects.toMatchObject({ code: CHECK_VIOLATION });
    expect((await stored(id))?.content).toBeNull();
  });
});
