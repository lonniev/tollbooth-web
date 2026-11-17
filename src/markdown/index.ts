/**
 * Markdown for a site's own text: `MarkdownText` draws it safely, and
 * `MarkdownEditor` is a sheet to write it in. A separate entry point, so a site
 * that shows no Markdown never loads the Markdown parser.
 *
 * Styles: `import "@tollbooth-dpyc/web/markdown.css"`.
 */

export { default as MarkdownText } from "./MarkdownText.tsx";
export { safePicture, safeUrl } from "./safe.ts";
export { default as MarkdownEditor, type MarkdownEditorProps } from "./MarkdownEditor.tsx";
export { applyMarkdown, wrap, prefixLines, fence, type Edited, type MarkdownTool } from "./edit.ts";
