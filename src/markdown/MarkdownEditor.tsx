/**
 * A big editor for Markdown: a sheet over the page with room to write, buttons
 * that add Markdown (bold, lists, checklists, links, code), and a preview of how
 * the page will show it. The whole screen on a phone.
 *
 * The site names what is being written (`title`, `label`) and may offer a
 * `placeholder`; the rest of the words are the package's.
 */

import { useEffect, useRef, useState } from "react";
import { Bold, Code, Heading2, Italic, Link2, List, ListChecks, ListOrdered, Quote, SquareCode, X } from "lucide-react";
import type { TranslationKey } from "../i18n/index.ts";
import { useT } from "../react/useT.ts";
import { applyMarkdown, type MarkdownTool } from "./edit.ts";
import MarkdownText from "./MarkdownText.tsx";

const TOOLS: { tool: MarkdownTool; icon: typeof Bold; name: TranslationKey }[] = [
  { tool: "bold", icon: Bold, name: "markdown.tool.bold" },
  { tool: "italic", icon: Italic, name: "markdown.tool.italic" },
  { tool: "heading", icon: Heading2, name: "markdown.tool.heading" },
  { tool: "bullets", icon: List, name: "markdown.tool.bullets" },
  { tool: "numbers", icon: ListOrdered, name: "markdown.tool.numbers" },
  { tool: "checklist", icon: ListChecks, name: "markdown.tool.checklist" },
  { tool: "quote", icon: Quote, name: "markdown.tool.quote" },
  { tool: "link", icon: Link2, name: "markdown.tool.link" },
  { tool: "code", icon: Code, name: "markdown.tool.code" },
  { tool: "codeBlock", icon: SquareCode, name: "markdown.tool.codeBlock" },
];

export interface MarkdownEditorProps {
  value: string;
  maxLength: number;
  /** The sheet's heading: what is being written. */
  title: string;
  /** The writing box's name for a screen reader; the title when not given. */
  label?: string;
  placeholder?: string;
  /** The text as it stands when the editor closes. */
  onDone: (text: string) => void;
}

export default function MarkdownEditor({ value, maxLength, title, label, placeholder, onDone }: MarkdownEditorProps) {
  const t = useT();
  const sheet = useRef<HTMLDialogElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState(value);
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    const d = sheet.current;
    if (d && !d.open) d.showModal();
    box.current?.focus();
  }, []);

  function use(tool: MarkdownTool) {
    const el = box.current;
    if (!el) return;
    const made = applyMarkdown(tool, text, el.selectionStart, el.selectionEnd, t("markdown.filler"));
    if (made.text.length > maxLength) return;
    setText(made.text);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(made.start, made.end); });
  }

  const done = () => onDone(text);
  return (
    <dialog ref={sheet} className="tb-md-sheet" onCancel={(e) => { e.preventDefault(); done(); }} aria-label={title}>
      <div className="tb-md-head">
        <h2 className="tb-md-title">{title}</h2>
        <button type="button" className="tb-md-done" onClick={done}>{t("markdown.done")}</button>
        <button type="button" className="tb-md-tool" onClick={done} aria-label={t("markdown.done")} title={t("markdown.done")}>
          <X size={22} aria-hidden />
        </button>
      </div>
      <div className="tb-md-views" role="group" aria-label={t("markdown.view")}>
        <button type="button" className="tb-md-pick" aria-pressed={!preview} onClick={() => setPreview(false)}>{t("markdown.write")}</button>
        <button type="button" className="tb-md-pick" aria-pressed={preview} onClick={() => setPreview(true)}>{t("markdown.preview")}</button>
      </div>
      {preview ? (
        <div className="tb-md-preview">{text.trim() ? <MarkdownText text={text} /> : <p className="tb-md-muted">{t("markdown.empty")}</p>}</div>
      ) : (
        <>
          <div className="tb-md-tools" role="toolbar" aria-label={t("markdown.tools")}>
            {TOOLS.map(({ tool, icon: Icon, name }) => (
              <button key={tool} type="button" className="tb-md-tool" onMouseDown={(e) => e.preventDefault()} onClick={() => use(tool)}
                aria-label={t(name)} title={t(name)}>
                <Icon size={20} aria-hidden />
              </button>
            ))}
          </div>
          <textarea ref={box} className="tb-md-text" value={text} maxLength={maxLength} onChange={(e) => setText(e.target.value)}
            placeholder={placeholder} aria-label={label ?? title} />
          <p className="tb-md-muted tb-md-small">{t("markdown.help")}</p>
        </>
      )}
      <p className="tb-md-muted tb-md-small tb-md-left">{t("markdown.charsLeft", { count: maxLength - text.length })}</p>
    </dialog>
  );
}
