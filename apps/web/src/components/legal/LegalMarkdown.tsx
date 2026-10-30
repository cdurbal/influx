// Display of a public document parsed by src/lib/legal-markdown.ts (docs/mvp/21 EC-62). Every
// value is a React text child, escaped by React: no HTML string, no dangerouslySetInnerHTML.
// The page holds the h1: the headings of the document start at h2.
import {
  CARD_TITLE,
  SECTION_TITLE,
} from "@/components/member/ui/heading-classes";
import { cn } from "@/components/ui/class-names";
import type { LegalBlock, LegalInline } from "@/lib/legal-markdown";

const HEADING_TAGS = { 1: "h2", 2: "h3", 3: "h4" } as const;

const HEADING_CLASSES = {
  vitrine: {
    1: "text-heading-3 font-bold text-text-primary",
    2: "text-lead font-semibold text-text-primary",
    3: "text-md font-semibold text-text-primary",
  },
  // Under KEO (the terms of the journey and of the gate): Manrope at the fixed sizes, no fluid token
  // (D75 RK-5); the two lower levels share the card title, the weight telling them from the text.
  keo: {
    1: cn(SECTION_TITLE, "text-text-primary"),
    2: cn(CARD_TITLE, "text-text-primary"),
    3: cn(CARD_TITLE, "text-text-primary"),
  },
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

export function LegalMarkdown({
  blocks,
  variant = "vitrine",
}: {
  blocks: readonly LegalBlock[];
  /** The charter the text is shown in: the public pages keep the vitrine's. */
  variant?: "vitrine" | "keo";
}) {
  return (
    <div className="flex max-w-(--measure-text) flex-col gap-4">
      {blocks.map((block, index) => {
        if (block.kind === "heading") {
          const Tag = HEADING_TAGS[block.level];
          return (
            <Tag
              key={index}
              className={cn(HEADING_CLASSES[variant][block.level], "pt-2")}
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
