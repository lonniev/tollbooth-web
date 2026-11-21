/**
 * Ship the browser-held session nsec to another npub the patron names.
 *
 * A NIP-17 DM (`nostrDm.ts`) signed by that session key. The plaintext nsec
 * never enters an MCP tool argument, a log line, or an error message — only
 * ciphertext leaves the page.
 */

import { sendDm, type DmResult, type Publish } from "./nostrDm.ts";

/** Plaintext body of the DM. Kept short; the nsec is the payload. */
export function sessionKeyDmBody(appName: string, nsec: string): string {
  return [
    `Your ${appName} session key (nsec).`,
    "Anyone who holds it is you — import it only into a client you control.",
    "",
    nsec,
  ].join("\n");
}

export type SessionKeyDmResult = DmResult;

/**
 * Send the session nsec to `recipientNpub`, signed by that same session key,
 * through `sendDm`. Throws on bad input; relay failures are in the result.
 */
export async function sendSessionKeyDm(opts: {
  appName: string;
  nsecBech32: string;
  recipientNpub: string;
  /** Injected for tests. */
  publish?: Publish;
  lookup?: (pubkeyHex: string) => Promise<string[]>;
}): Promise<SessionKeyDmResult> {
  return sendDm({
    to: opts.recipientNpub,
    body: sessionKeyDmBody(opts.appName, opts.nsecBech32),
    publish: opts.publish,
    lookup: opts.lookup,
  });
}
