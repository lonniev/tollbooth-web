/**
 * The two tools a newcomer needs, offered under the sign-in card: a Nostr
 * client and Pricing Studio. Links open in a new tab; the credit line for
 * other companies' marks is on by default and off where the page's own legal
 * footer already carries it.
 *
 * Mechanics only: the list, the targets and the credit are the package's;
 * every class is the site's.
 */

import type { ReactNode } from "react";
import { cx } from "./cx.ts";
import { SIGN_IN_LINKS, SIGN_IN_LINKS_CREDIT, type SignInLink } from "./signInTools.ts";

export interface SignInLinksClassNames {
  root?: string;
  lead?: string;
  list?: string;
  item?: string;
  link?: string;
  /** The app's mark. */
  logo?: string;
  /** Around the name and line, beside the mark. */
  text?: string;
  name?: string;
  line?: string;
  credit?: string;
}

export interface SignInLinksProps {
  /** Default: 0xchat and Pricing Studio. */
  links?: readonly SignInLink[];
  /** A line above the list. Default "New to Nostr? These two are all it takes." */
  lead?: ReactNode;
  /** The trademark credit. Default true; false when the page's footer carries it. */
  credit?: boolean;
  classNames?: SignInLinksClassNames;
}

export default function SignInLinks({
  links = SIGN_IN_LINKS,
  lead = "New to Nostr? These two are all it takes.",
  credit = true,
  classNames: c = {},
}: SignInLinksProps) {
  return (
    <nav aria-label="Tools for signing in" className={c.root}>
      {lead && <p className={c.lead}>{lead}</p>}
      <ul className={c.list}>
        {links.map((l) => (
          <li key={l.id} className={c.item}>
            <a href={l.href} target="_blank" rel="noopener noreferrer" className={cx(c.link)}>
              {l.logo && <img src={l.logo} alt="" width={40} height={40} className={c.logo} />}
              <span className={c.text}>
                <span className={c.name}>{l.name}</span>
                <span className={c.line}>{l.line}</span>
              </span>
            </a>
          </li>
        ))}
      </ul>
      {credit && <p className={c.credit}>{SIGN_IN_LINKS_CREDIT}</p>}
    </nav>
  );
}
