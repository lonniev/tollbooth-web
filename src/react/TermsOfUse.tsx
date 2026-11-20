/**
 * The terms of use, drawn: a heading in the reader's language, then the
 * sections in English (`termsOfUse` builds them), packed into columns so a
 * short section leaves no gap under it. Every visual choice is the site's,
 * through `classNames`.
 */

import type { ReactNode } from "react";
import type { TermsSection } from "../termsOfUse.ts";

export interface TermsOfUseClassNames {
  root?: string;
  header?: string;
  heading?: string;
  /** Around the sections. The package sets the columns; a site adds its gaps. */
  sections?: string;
  section?: string;
  title?: string;
  line?: string;
}

export interface TermsOfUseProps {
  /** The page's heading, in the reader's language. */
  heading: ReactNode;
  /** What `termsOfUse()` returned. */
  sections: TermsSection[];
  classNames?: TermsOfUseClassNames;
}

export default function TermsOfUse({ heading, sections, classNames: c = {} }: TermsOfUseProps) {
  return (
    <div className={c.root}>
      <header className={c.header}><h1 className={c.heading}>{heading}</h1></header>
      <div lang="en" className={c.sections} style={{ columnWidth: "24rem" }}>
        {sections.map((s) => (
          <section key={s.title} className={c.section} style={{ breakInside: "avoid" }}>
            <h2 className={c.title}>{s.title}</h2>
            {s.says.map((line) => <p key={line} className={c.line}>{line}</p>)}
          </section>
        ))}
      </div>
    </div>
  );
}
