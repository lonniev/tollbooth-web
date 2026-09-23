/**
 * Pure rules for the Nostr profile panel, testable under node:test.
 */

export type PublishControlMode = "publish" | "how-to-set";

/** Without a session key or NIP-07 signer, explain instead of publishing. */
export function publishControlMode(canSign: boolean): PublishControlMode {
  return canSign ? "publish" : "how-to-set";
}

export function publishControlLabel(mode: PublishControlMode, publishing: boolean): string {
  if (mode === "how-to-set") return "How to set…";
  return publishing ? "Publishing…" : "Publish to Nostr";
}

/**
 * "How to set…" must never be disabled: a disabled element fires no pointer
 * events, so its handler never runs — and an iPad has no hover to fall back on.
 */
export function publishControlDisabled(mode: PublishControlMode, publishing: boolean): boolean {
  return mode === "publish" && publishing;
}

export function collapsedDisplayName(displayName: string): string {
  return displayName.trim() || "Nostr profile";
}

export function howToSetExplainer(appName: string): { title: string; paragraphs: string[] } {
  return {
    title: "How to set your Nostr profile",
    paragraphs: [
      `Nostr identity is a secure keypair. Your profile is owned by the key, not by ${appName}.`,
      "To change it, use your preferred Nostr client — the one that already holds your key.",
      `${appName} could accept your nsec directly, but deliberately does not ask for it. Handing a private key to a web front end is the thing the keypair model exists to avoid.`,
    ],
  };
}
