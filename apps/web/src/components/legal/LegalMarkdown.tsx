// Display of a public document parsed by src/lib/legal-markdown.ts (docs/mvp/21 EC-62). Every
// value is a React text child, escaped by React: no HTML string, no dangerouslySetInnerHTML.
// The page holds the h1: the headings of the document start at h2.
import { cn } from "@/components/ui/class-names";
import type { LegalBlock, LegalInline } from "@/lib/legal-markdown";

const HEADING_TAGS = { 1: "h2", 2: "h3", 3: "h4" } as const;

const HEADING_CLASSES = {
  1: "text-heading-3 font-bold text-text-primary",
  2: "text-lead font-semibold text-text-primary",
  3: "text-md font-semibold text-text-primary",
} as const;

function Inline({ runs }: { runs: readonly LegalInline[] }) {
  return runs.map((run, index) =>
    run.kind === "strong" ? (
      <strong key={index} className="font-semibold text-text-primary">
        {run.text}
      </strong>
    ) : (
      <span key={index}>{run.text}</span>
    ),
  );
}

export function LegalMarkdown({ blocks }: { blocks: readonly LegalBlock[] }) {
  return (
    <div className="flex max-w-(--measure-text) flex-col gap-4">
      {blocks.map((block, index) => {
        if (block.kind === "heading") {
          const Tag = HEADING_TAGS[block.level];
          return (
            <Tag
              key={index}
              className={cn(HEADING_CLASSES[block.level], "pt-2")}
            >
              <Inline runs={block.content} />
            </Tag>
          );
        }
        if (block.kind === "list") {
          return (
            <ul
              key={index}
              className="flex list-disc flex-col gap-2 pl-5 text-md text-text-secondary"
            >
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>
                  <Inline runs={item} />
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={index} className="text-md text-text-secondary">
            <Inline runs={block.content} />
          </p>
        );
      })}
    </div>
  );
}
