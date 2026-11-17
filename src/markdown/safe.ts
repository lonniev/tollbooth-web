/** What Markdown may point at: web pages and email links, and pictures from https only. */

import { defaultUrlTransform } from "react-markdown";

const SAFE_LINK = /^(https?:|mailto:)/i;

/** Only web pages and email become links; anything else becomes no link. */
export function safeUrl(url: string): string {
  const kept = defaultUrlTransform(url);
  return SAFE_LINK.test(kept) ? kept : "";
}

/** A picture is drawn only from an https address. */
export const safePicture = (src: unknown): src is string => typeof src === "string" && src.startsWith("https://");
