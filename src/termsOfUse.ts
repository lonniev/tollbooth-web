/**
 * Terms of use: the agreement between a person and the operator of a Tollbooth
 * site, which a site's own contracts (between its users) cannot be.
 *
 * Every site says the same things about keys, fees, the Good Brew café and the
 * DPYC™ marks, so those sections are written once, here. A site brings the
 * sections only it can write (what its service is, what it keeps) and gets the
 * whole page back in order: its own first, then the shared ones.
 *
 * The terms stay in English, the language they are written and read in; a site
 * translates only the heading around them.
 */

/** One section of the terms: a title and its sentences, one to a line. */
export interface TermsSection {
  title: string;
  says: string[];
}

export interface TermsOfUseOptions {
  /** The site's name, as the sections speak of it ("FieldData", "CommissionMarket"). */
  name: string;
  /** The site's own sections, which come first. */
  own: TermsSection[];
  /** The site shows the Good Brew café's Catalog. */
  cafe?: boolean;
  /** Other marks the site names, each a sentence, after the DPYC™ marks. */
  marks?: string[];
}

const KEY: TermsSection = {
  title: "Your key to the account",
  says: [
    "Your Nostr key is your identity here, and nobody can recover it for you.",
    "Anyone holding your nsec can act as you, so keep it to yourself.",
  ],
};

const FEES: TermsSection = {
  title: "Fees",
  says: [
    "Tool fees are set by the operator's live pricing model, which you may read at any time.",
    "You pay them from a balance of api_sats funded in Bitcoin Lightning, and a tool call that ends in an error is refunded.",
    "Lightning payments are final, and credit may expire as the pricing model states.",
  ],
};

const catalog = (name: string): TermsSection => ({
  title: "The Catalog",
  says: [
    `The Catalog shows collections from the Good Brew café, and ${name} takes no orders.`,
    "Orders, payment and delivery are between you and the café, under the café's own terms.",
  ],
});

const DPYC_MARKS = "DPYC™, Tollbooth DPYC™ and Don't Pester Your Customer™ are marks of Lonnie VanZandt.";

/** A site's whole terms of use: its own sections, then the shared ones. */
export function termsOfUse({ name, own, cafe = false, marks = [] }: TermsOfUseOptions): TermsSection[] {
  if (!name.trim()) throw new Error("termsOfUse: the site's name is required");
  const shared = new Set([KEY.title, FEES.title, "The Catalog", "Marks"]);
  for (const s of own) {
    if (shared.has(s.title)) throw new Error(`termsOfUse: "${s.title}" is a shared section; leave it out of own`);
    if (!s.says.length) throw new Error(`termsOfUse: "${s.title}" says nothing`);
  }
  return [...own, KEY, FEES, ...(cafe ? [catalog(name)] : []), { title: "Marks", says: [DPYC_MARKS, ...marks] }];
}
