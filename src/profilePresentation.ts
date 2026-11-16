/**
 * Pure rules for the Nostr profile panel, testable under node:test.
 */

import { translate } from "./i18n/index.ts";

export type PublishControlMode = "publish" | "how-to-set";

/** Without a session key or NIP-07 signer, explain instead of publishing. */
export function publishControlMode(canSign: boolean): PublishControlMode {
  return canSign ? "publish" : "how-to-set";
}

export function publishControlLabel(mode: PublishControlMode, publishing: boolean): string {
  if (mode === "how-to-set") return translate("profile.howToSet");
  return publishing ? translate("profile.publishing") : translate("profile.publish");
}

/**
 * "How to set…" must never be disabled: a disabled element fires no pointer
 * events, so its handler never runs — and an iPad has no hover to fall back on.
 */
export function publishControlDisabled(mode: PublishControlMode, publishing: boolean): boolean {
  return mode === "publish" && publishing;
}

export function collapsedDisplayName(displayName: string): string {
  return displayName.trim() || translate("profile.fallbackName");
}

export function howToSetExplainer(appName: string): { title: string; paragraphs: string[] } {
  return {
    title: translate("profile.howTo.title"),
    paragraphs: [
      translate("profile.howTo.ownedByKey", { appName }),
      translate("profile.howTo.useClient"),
      translate("profile.howTo.noNsec", { appName }),
    ],
  };
}
