/**
 * Reading a sign-in failure back to the human who caused none of it.
 *
 * Every operator draws its relay set from the DPYC Oracle at cold start. A
 * container that has just woken has nothing cached, so the first sign-in
 * against it is one Oracle blip away from failing — and what the patron was
 * shown was the SDK's internal diagnosis, addressed to whoever maintains the
 * SDK. To the person signing in it read as "your key is broken", which it is
 * not: the next attempt usually works.
 *
 * So lead with what happened and what to do, and keep the original text
 * underneath rather than swallowing it. Interpreting an error is not hiding it.
 */

import { translate } from "./i18n/index.ts";

export interface Situation {
  /** What to say first. One sentence, addressed to the person, not the log. */
  lead: string;
  /** True when trying the same thing again is genuinely likely to work. */
  retryable: boolean;
  /** The service's own words, kept verbatim. Empty when `lead` already is them. */
  detail: string;
}

/** Substrings that identify a service that is awake but not yet ready. */
const WARMING = [
  "relay registry unreachable",
  "cannot reach oracle",
  "persistence layer unreachable",
  "service unavailable",
  "only bootstrap tools",
];

const UNREACHABLE = ["failed to fetch", "networkerror", "load failed", "timeout", "timed out"];

export function readSignInFailure(raw: string, name?: string): Situation {
  const appName = name === undefined ? translate("signin.failure.theService") : name;
  const detail = (raw || "").trim() || translate("signin.failure.noReason");
  const hay = detail.toLowerCase();

  if (WARMING.some((s) => hay.includes(s))) {
    return {
      lead: translate("signin.failure.warming", { appName }),
      retryable: true,
      detail,
    };
  }

  if (UNREACHABLE.some((s) => hay.includes(s))) {
    return {
      lead: translate("signin.failure.unreachable", { appName }),
      retryable: true,
      detail,
    };
  }

  return { lead: detail, retryable: false, detail: "" };
}
