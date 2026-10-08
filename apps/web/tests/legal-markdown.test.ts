// The restricted Markdown of the public documents (docs/mvp/21 EC-62): only `#` to `###`,
// paragraphs, `- ` lists and `**bold**` are recognised; every other pattern stays as text, and no
// HTML is ever interpreted, whatever the text holds.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LegalMarkdown } from "@/components/legal/LegalMarkdown";
import { parseLegalInline, parseLegalMarkdown } from "@/lib/legal-markdown";

const WEB_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const LEGAL_ROOT = path.resolve(WEB_ROOT, "..", "api", "legal");

function render(source: string): string {
  return renderToStaticMarkup(
    createElement(LegalMarkdown, { blocks: parseLegalMarkdown(source) }),
  );
}

describe("parseLegalMarkdown: the recognised patterns", () => {
  it("reads headings of three levels, paragraphs and lists", () => {
    expect(
      parseLegalMarkdown(
        "# One\n\n## Two\n### Three\nFirst line\nsame paragraph\n\n- a\n- **b**\n\nEnd",
      ),
    ).toEqual([
      { kind: "heading", level: 1, content: [{ kind: "text", text: "One" }] },
      { kind: "heading", level: 2, content: [{ kind: "text", text: "Two" }] },
      {
        kind: "heading",
        level: 3,
        content: [{ kind: "text", text: "Three" }],
      },
      {
        kind: "paragraph",
        content: [{ kind: "text", text: "First line same paragraph" }],
      },
      {
        kind: "list",
        items: [[{ kind: "text", text: "a" }], [{ kind: "strong", text: "b" }]],
      },
      { kind: "paragraph", content: [{ kind: "text", text: "End" }] },
    ]);
  });

  it("reads bold runs inside a line, and leaves an unpaired marker as text", () => {
    expect(parseLegalInline("a **b** c **d")).toEqual([
      { kind: "text", text: "a " },
      { kind: "strong", text: "b" },
      { kind: "text", text: " c **d" },
    ]);
    expect(parseLegalInline("****")).toEqual([{ kind: "text", text: "****" }]);
  });

  it("reads CRLF like LF", () => {
    expect(parseLegalMarkdown("# A\r\n\r\nB\r\n")).toEqual(
      parseLegalMarkdown("# A\n\nB\n"),
    );
  });
});

describe("parseLegalMarkdown: everything else stays as text", () => {
  it.each([
    ["a fourth heading level", "#### Four"],
    ["a heading without a space", "#Title"],
    ["a numbered list", "1. first"],
    ["a list with a star", "* item"],
    ["a link", "[INFLUX](https://example.test)"],
    ["an automatic link", "<https://example.test>"],
    ["an image", "![x](https://example.test/x.png)"],
    ["inline code", "`code`"],
    ["italics", "_a_ *b*"],
    ["a quote", "> quoted"],
    ["a script tag", '<script>alert("x")</script>'],
    ["an HTML attribute", '<img src=x onerror="alert(1)">'],
    ["an entity", "&lt;b&gt;"],
  ])("%s", (_name, source) => {
    const blocks = parseLegalMarkdown(source);
    expect(blocks).toEqual([
      { kind: "paragraph", content: [{ kind: "text", text: source }] },
    ]);
  });
});

describe("LegalMarkdown: no HTML is interpreted", () => {
  it("renders the recognised patterns as their elements, headings from h2", () => {
    expect(render("# T\n\n## S\n\n### U\n\nP **b**\n\n- i")).toBe(
      '<div class="flex max-w-(--measure-text) flex-col gap-4">' +
        '<h2 class="text-heading-3 font-bold text-text-primary pt-2"><span>T</span></h2>' +
        '<h3 class="text-lead font-semibold text-text-primary pt-2"><span>S</span></h3>' +
        '<h4 class="text-md font-semibold text-text-primary pt-2"><span>U</span></h4>' +
        '<p class="text-md text-text-secondary"><span>P </span>' +
        '<strong class="font-semibold text-text-primary">b</strong></p>' +
        '<ul class="flex list-disc flex-col gap-2 pl-5 text-md text-text-secondary">' +
        "<li><span>i</span></li></ul></div>",
    );
  });

  it("escapes markup, in a paragraph, a heading, a list item and a bold run", () => {
    const html = render(
      '<script>alert(1)</script>\n\n# <img src=x onerror="a()">\n\n- <b>x</b>\n\n**<i>y</i>**',
    );
    expect(html).not.toMatch(/<(script|img|b|i)[\s>]/);
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain("&lt;img src=x onerror=&quot;a()&quot;&gt;");
    expect(html).toContain("&lt;b&gt;x&lt;/b&gt;");
    expect(html).toContain("&lt;i&gt;y&lt;/i&gt;");
  });

  it("never links: no anchor, whatever the text", () => {
    expect(
      render("[a](https://example.test) <https://example.test>"),
    ).not.toContain("<a");
  });
});

describe("the published drafts (apps/api/legal)", () => {
  const drafts = readdirSync(LEGAL_ROOT, { recursive: true })
    .map(String)
    .filter((file) => file.endsWith(".md"));

  it("use the recognised patterns only: every line is a heading, an item or text", () => {
    expect(drafts.length).toBeGreaterThanOrEqual(6);
    for (const file of drafts) {
      const source = readFileSync(path.join(LEGAL_ROOT, file), "utf8");
      const blocks = parseLegalMarkdown(source);
      expect(blocks[0], file).toEqual({
        kind: "paragraph",
        content: [
          {
            kind: "strong",
            text: "Projet non contractuel / Draft, not contractual",
          },
        ],
      });
      expect(
        blocks.filter((block) => block.kind === "heading")[0],
        file,
      ).toMatchObject({ level: 1 });
    }
  });
});
