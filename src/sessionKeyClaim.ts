/**
 * Claiming the session key — the pure rules behind the SessionKeyClaim card.
 *
 * The hard requirement: show nothing unless THIS browser holds the key for
 * the npub that is signed in. A patron on NIP-07 or a courier proof must
 * never see a claim that the site holds their key.
 *
 * A patron exporting their OWN key is self-addressed by construction; what
 * the ecosystem forbids is a service leaking keys, not a person claiming one.
 */

/** True only when the browser holds the session nsec for the signed-in npub. */
export function sessionKeyClaimVisible(opts: {
  hasSessionNsec: boolean;
  sessionNsecNpub: string | null;
  signedInNpub: string;
}): boolean {
  const signedIn = opts.signedInNpub.trim();
  if (!signedIn || !opts.hasSessionNsec) return false;
  const held = opts.sessionNsecNpub?.trim() ?? "";
  return held !== "" && held === signedIn;
}

/** The variable a site's key goes under, e.g. "GOODEARTH_NSEC". */
export function sessionKeyEnvName(slug: string): string {
  return `${slug.toUpperCase()}_NSEC`;
}

/** Contents of the downloadable `.env` hand-off. */
export function sessionKeyEnvContents(slug: string, nsec: string): string {
  return `${sessionKeyEnvName(slug)}=${nsec}\n`;
}

/** Suggested filename for the `.env` hand-off, e.g. "goodearth-nsec.env". */
export function sessionKeyEnvFilename(slug: string): string {
  return `${slug}-nsec.env`;
}

/**
 * What the password-manager destination may honestly report.
 * A web page cannot write to an OS keychain; say what actually happened.
 */
export type PasswordManagerOutcome =
  | "stored" // Credential Management API accepted a PasswordCredential
  | "prompted" // a form was submitted so a browser password manager could offer to save
  | "unsupported"; // nothing the page can do here

export function passwordManagerOutcomeLabel(o: PasswordManagerOutcome): string {
  switch (o) {
    case "stored":
      return "Offered to your browser’s password manager.";
    case "prompted":
      return "Submitted so your browser’s password manager can offer to save it. Nothing was written to an OS keychain — a web page cannot do that.";
    case "unsupported":
      return "This browser has no password-manager save path the page can reach. Download the .env file or copy the key instead.";
  }
}
