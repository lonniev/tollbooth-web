/**
 * The toolbar's edits to Markdown text: each takes the text and the selection
 * and returns the new text and where the selection goes. Pure, so tested in Node.
 */

export interface Edited {
  text: string;
  start: number;
  end: number;
}

export type MarkdownTool = "bold" | "italic" | "heading" | "bullets" | "numbers" | "checklist" | "quote" | "link" | "code" | "codeBlock";

/** Put `before` and `after` around the selection, or around `filler` when nothing is selected; the inside stays selected. */
export function wrap(text: string, start: number, end: number, before: string, after: string, filler: string): Edited {
  const inside = text.slice(start, end) || filler;
  const out = text.slice(0, start) + before + inside + after + text.slice(end);
  return { text: out, start: start + before.length, end: start + before.length + inside.length };
}

/** The start of the line `at` sits on. */
const lineStart = (text: string, at: number) => text.lastIndexOf("\n", at - 1) + 1;

/** Begin every line the selection touches with `prefix` (numbered lines count up). */
export function prefixLines(text: string, start: number, end: number, prefix: string | ((n: number) => string)): Edited {
  const from = lineStart(text, start);
  const toEnd = text.indexOf("\n", end);
  const to = toEnd === -1 ? text.length : toEnd;
  const lines = text.slice(from, to).split("\n");
  const marked = lines.map((line, i) => (typeof prefix === "string" ? prefix : prefix(i + 1)) + line);
  const block = marked.join("\n");
  return { text: text.slice(0, from) + block + text.slice(to), start: from, end: from + block.length };
}

/** A fenced code block around the selected lines, on lines of its own. */
export function fence(text: string, start: number, end: number, filler: string): Edited {
  const inside = text.slice(start, end) || filler;
  const before = start > 0 && text[start - 1] !== "\n" ? "\n```\n" : "```\n";
  const after = end < text.length && text[end] !== "\n" ? "\n```\n" : "\n```";
  const out = text.slice(0, start) + before + inside + after + text.slice(end);
  return { text: out, start: start + before.length, end: start + before.length + inside.length };
}

/** What each toolbar button does. `filler` is the word put in when nothing is selected. */
export function applyMarkdown(tool: MarkdownTool, text: string, start: number, end: number, filler: string): Edited {
  switch (tool) {
    case "bold": return wrap(text, start, end, "**", "**", filler);
    case "italic": return wrap(text, start, end, "_", "_", filler);
    case "code": return wrap(text, start, end, "`", "`", filler);
    case "link": {
      const made = wrap(text, start, end, "[", "](https://)", filler);
      // Leave the cursor where the address goes.
      const at = made.end + 2 + "https://".length;
      return { text: made.text, start: at, end: at };
    }
    case "heading": return prefixLines(text, start, end, "## ");
    case "bullets": return prefixLines(text, start, end, "- ");
    case "numbers": return prefixLines(text, start, end, (n) => `${n}. `);
    case "checklist": return prefixLines(text, start, end, "- [ ] ");
    case "quote": return prefixLines(text, start, end, "> ");
    case "codeBlock": return fence(text, start, end, filler);
  }
}
