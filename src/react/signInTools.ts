/**
 * Where a visitor gets the two tools the sign-in leans on: a Nostr client that
 * holds their key and answers the message, and Pricing Studio, where the
 * operators of this network price their tools.
 *
 * 0xchat links to its own download page rather than to one store, so the
 * link stays right as its listings move. Pricing Studio's App Store page is
 * public (id 6760925205). Apple's wording rule: an app is *available on the
 * App Store*, never *at*.
 */

export interface SignInLink {
  id: string;
  name: string;
  href: string;
  /** One short line under the name. */
  line: string;
}

export const SIGN_IN_LINKS: readonly SignInLink[] = [
  {
    id: "0xchat",
    name: "0xchat",
    href: "https://0xchat.com",
    line: "A Nostr client for iPhone, Android and desktop. It holds your key and answers the sign-in message.",
  },
  {
    id: "pricing-studio",
    name: "Pricing Studio",
    href: "https://apps.apple.com/us/app/pricing-studio/id6760925205",
    line: "Where operators price their tools, live. Available on the App Store.",
  },
];

/** Shown once, small, wherever the links are — unless the page already carries a legal footer. */
export const SIGN_IN_LINKS_CREDIT =
  "App Store is a trademark of Apple Inc., registered in the U.S. and other countries. 0xchat is a trademark of its owner.";
