// T15 (D72, docs/mvp/decisions.md): every error is an alert icon plus its text, and
// the error fill is used nowhere but in the component.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ErrorNotice } from "@/components/ui/ErrorNotice";

function sourcesUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? sourcesUnder(join(dir, entry.name))
      : /\.(ts|tsx)$/.test(entry.name)
        ? [join(dir, entry.name)]
        : [],
  );
}

describe("ErrorNotice (T15)", () => {
  it("renders a decorative triangle icon and the text inside role=alert", () => {
    const html = renderToStaticMarkup(
      createElement(ErrorNotice, { id: "e" }, "Something failed"),
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain('id="e"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain("lucide-triangle-alert");
    expect(html).toContain("Something failed");
  });

  it("drops the role for a field error tied to its input", () => {
    const html = renderToStaticMarkup(
      createElement(ErrorNotice, { announce: false }, "Required"),
    );
    expect(html).not.toContain("role=");
    expect(html).toContain("Required");
  });

  it("is the only place that applies the error classes or the error fill", () => {
    const offenders = sourcesUnder("src").filter((file) => {
      if (/(ErrorNotice\.tsx|auth-classes\.ts)$/.test(file)) return false;
      const text = readFileSync(file, "utf8");
      return (
        text.includes("ERROR_CLASSES") || text.includes("bg-feedback-error-bg")
      );
    });
    expect(offenders).toEqual([]);
  });
});
