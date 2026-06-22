import React from "react";

interface MarkdownRendererProps {
  content: string;
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  if (!content) {
    return (
      <div className="text-zinc-500 italic font-sans">
        The scribes have not yet compiled the campaign chronicle...
      </div>
    );
  }

  // Pure React regex-based markdown converter optimized for high-fantasy summaries
  const lines = content.split("\n");

  return (
    <div className="space-y-4 font-sans text-zinc-200 leading-relaxed max-w-none">
      {lines.map((line, idx) => {
        const trimmed = line.trim();

        // Empty lines
        if (!trimmed) {
          return <div key={idx} className="h-2" />;
        }

        // H1 Title headings (e.g. # 📜 SESSION TITLE)
        if (trimmed.startsWith("# ")) {
          const text = trimmed.replace("# ", "");
          return (
            <h2
              key={idx}
              className="text-2xl font-fantasy font-bold text-red-400 tracking-wide border-b border-zinc-800 pb-2 pt-4 flex items-center gap-2"
              id={`md-h1-${idx}`}
            >
              {text}
            </h2>
          );
        }

        // H2 Headings (e.g. ## ⚔️ HIGHLIGHTS)
        if (trimmed.startsWith("## ")) {
          const text = trimmed.replace("## ", "");
          return (
            <h3
              key={idx}
              className="text-xl font-fantasy font-semibold text-red-500 tracking-wide pt-3 flex items-center gap-2"
              id={`md-h2-${idx}`}
            >
              {text}
            </h3>
          );
        }

        // H3 Headings
        if (trimmed.startsWith("### ")) {
          const text = trimmed.replace("### ", "");
          return (
            <h4
              key={idx}
              className="text-md font-fantasy font-medium text-red-200 uppercase tracking-wider pt-2"
              id={`md-h3-${idx}`}
            >
              {text}
            </h4>
          );
        }

        // Horizontal Rule
        if (trimmed === "---") {
          return <hr key={idx} className="border-t border-zinc-800 my-4" />;
        }

        // Bulleted lists
        if (trimmed.startsWith("* ") || trimmed.startsWith("- ")) {
          let text = trimmed.substring(2);
          // Parse inline bolding **word** -> <strong>word</strong>
          const italicized = parseInlineFormatting(text);
          return (
            <div key={idx} className="flex gap-2 pl-4 text-zinc-300">
              <span className="text-red-500 select-none">✦</span>
              <p className="flex-1 text-sm md:text-base">{italicized}</p>
            </div>
          );
        }

        // Text Line with general Paragraphing & inline parsing
        return (
          <p key={idx} className="text-zinc-300 text-sm md:text-base leading-relaxed">
            {parseInlineFormatting(trimmed)}
          </p>
        );
      })}
    </div>
  );
}

// Helper to convert **bold** text and other inline tokens into react structures
function parseInlineFormatting(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*.*?\*\*)/);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="text-red-400 font-semibold font-fantasy">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={i}>{part}</span>;
  });
}
