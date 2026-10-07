import type { ReactNode } from "react";

function inlineMarkdown(value: string) {
  return value.split(/(\*\*.*?\*\*|\`[^\`]+\`)/g).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("\`") && part.endsWith("\`")) {
      return <code key={index}>{part.slice(1, -1)}</code>;
    }
    return part || " ";
  });
}

export function MessageText({ content }: { content: string }) {
  const clean = content
    .replace(/&#x20;|&#32;|&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\\([\`*.#_>\-])/g, "$1")
    .replace(/\bMOVE_IN\b/g, "move in")
    .replace(/\bMOVE_OUT\b/g, "move out")
    .replace(/\bREADY_TO_SUBMIT\b/g, "ready to submit")
    .replace(/\bUNDER_REVIEW\b/g, "under review")
    .replace(/\b[A-Z][A-Z0-9_]{2,}\b/g, (value) =>
      value
        .toLowerCase()
        .replaceAll("_", " ")
        .replace(/^./, (character) => character.toUpperCase()),
    )
    .replace(/[ \t]+\n/g, "\n")
    .trim();

  const nodes: ReactNode[] = [];
  let codeLines: string[] = [];
  let inCodeBlock = false;

  clean.split("\n").forEach((line, index) => {
    if (line.trim().startsWith("\`\`\`")) {
      if (inCodeBlock) {
        nodes.push(
          <pre key={"code-" + index}>
            <code>{codeLines.join("\n")}</code>
          </pre>,
        );
        codeLines = [];
      }
      inCodeBlock = !inCodeBlock;
      return;
    }
    if (inCodeBlock) {
      codeLines.push(line);
      return;
    }
    nodes.push(<p key={"line-" + index}>{inlineMarkdown(line)}</p>);
  });

  if (codeLines.length) {
    nodes.push(
      <pre key="code-final">
        <code>{codeLines.join("\n")}</code>
      </pre>,
    );
  }

  return <div className="message-copy">{nodes}</div>;
}
