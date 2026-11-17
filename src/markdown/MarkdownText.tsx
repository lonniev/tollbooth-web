/**
 * Text a person wrote in Markdown, drawn on the page: headings, bold and
 * italic, lists and checklists, links, quotes, tables and code blocks.
 *
 * Nothing in it can run. Raw HTML is never drawn, links open in a new tab and
 * only to http(s) or mailto, and a picture shows only from an https address,
 * so no script, no `javascript:` link and no data blob reaches the page.
 */

import Markdown, { type Components } from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import { safePicture, safeUrl } from "./safe.ts";

const COMPONENTS: Components = {
  a: ({ href, children }) => (href
    ? <a href={href} target="_blank" rel="noopener noreferrer nofollow">{children}</a>
    : <span>{children}</span>),
  img: ({ src, alt }) => (safePicture(src)
    ? <img src={src} alt={alt ?? ""} loading="lazy" referrerPolicy="no-referrer" />
    : <span className="tb-md-muted">{alt}</span>),
};

export default function MarkdownText({ text, className }: { text: string; className?: string }) {
  return (
    <div className={className ? `tb-md ${className}` : "tb-md"}>
      <Markdown remarkPlugins={[remarkGfm, remarkBreaks]} skipHtml urlTransform={safeUrl} components={COMPONENTS}>
        {text}
      </Markdown>
    </div>
  );
}
